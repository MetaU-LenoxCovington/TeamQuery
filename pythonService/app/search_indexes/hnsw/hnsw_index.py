import heapq
import logging
import math
import random
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple, TYPE_CHECKING
from datetime import datetime

import numpy as np
import pickle
from pathlib import Path

from .hnsw_node import HNSWNode
from app.services.database_service import database_service

if TYPE_CHECKING:
    from .hnsw_node import HNSWNode as HNSWNodeType

logger = logging.getLogger(__name__)


class HNSWIndex:

    def __init__(
        self,
        organization_id: str,
        M: int = 16,
        ef_construction: int = 200,
        M_L: float = 1 / math.log(2.0),
        seed: int = None,
    ):
        """
        Args:
            organization_id: Organization this index belongs to
            M: Maximum number of undirected links for each node (except layer 0)
            ef_construction: Size of the dynamic candidate list during construction
            M_L: Level generation factor
            seed: Random seed
        """
        self.organization_id = organization_id
        self.M = M
        self.max_M = M
        self.max_M0 = M * 2  # Layer 0 has double the connections
        self.ef_construction = ef_construction
        self.M_L = M_L

        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)

        self.nodes: Dict[str, HNSWNode] = {}

        # layer -> set of node IDs
        self.layers: Dict[int, Set[str]] = defaultdict(set)

        # Entry point for search (highest layer)
        self.entry_point: Optional[str] = None
        self.max_layer: int = 0

        self.size = 0

    def _select_level(self) -> int:
        """Select a random level for a new node.
        Number of nodes at each layer grows exponentially as you go down the layers
        """
        level = int(-math.log(random.random()) * self.M_L)
        return level

    def _search_layer(
        self,
        query_vector: np.ndarray,
        entry_points: List[str],
        num_closest: int,
        layer: int,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[float, str]]:
        """
        Search for closest nodes in a specific layer

        Args:
            query_vector: Query vector to search for
            entry_points: Starting points for the search
            num_closest: Number of closest nodes to return
            layer: Layer to search in
            filters: Optional metadata filters

        Returns:
            List of (distance, node_id) tuples sorted by distance
        """
        visited = set()
        candidates = []  # Min heap: (distance, node_id)
        w = []  # Max heap: (-distance, node_id) for tracking closest

        # Initialize with entry points
        for ep_id in entry_points:
            if ep_id not in self.nodes:
                continue

            ep_node = self.nodes[ep_id]
            distance = ep_node.distance_to_vector(query_vector)
            heapq.heappush(candidates, (distance, ep_id))
            heapq.heappush(w, (-distance, ep_id))
            visited.add(ep_id)

        while candidates:
            current_dist, current_id = heapq.heappop(candidates)

            # If current distance is worse than the worst in w, stop
            if w and current_dist > -w[0][0]:
                break

            current_node = self.nodes[current_id]

            # Check all connections of current node at this layer
            for neighbor_id in current_node.get_connections(layer):
                if neighbor_id in visited or neighbor_id not in self.nodes:
                    continue

                visited.add(neighbor_id)
                neighbor_node = self.nodes[neighbor_id]

                distance = neighbor_node.distance_to_vector(query_vector)

                if len(w) < num_closest:
                    heapq.heappush(candidates, (distance, neighbor_id))
                    heapq.heappush(w, (-distance, neighbor_id))
                elif distance < -w[0][0]:
                    heapq.heappush(candidates, (distance, neighbor_id))
                    heapq.heappush(w, (-distance, neighbor_id))

                    # Remove the worst element if we exceed num_closest
                    if len(w) > num_closest:
                        heapq.heappop(w)

        # Convert max heap to sorted list
        result = []
        while w:
            neg_dist, node_id = heapq.heappop(w)
            result.append((-neg_dist, node_id))

        result.reverse()  # Best distance first
        return result

    def _select_neighbors_heuristic(
        self,
        candidates: List[Tuple[float, str]],
        M: int,
        layer: int,
        extend_candidates: bool = True,
        keep_pruned_connections: bool = True,
    ) -> List[str]:
        """
        Select M neighbors from candidates using heuristic to maintain connectivity.

        This implements the algorithm from the HNSW paper for maintaining
        good graph connectivity while limiting the number of connections.
        """
        if len(candidates) <= M:
            return [node_id for _, node_id in candidates]

        # Sort candidates by distance
        candidates = sorted(candidates)

        if not extend_candidates:
            return [node_id for _, node_id in candidates[:M]]

        # Heuristic selection to maintain diversity
        selected = []
        remaining = list(candidates)

        while len(selected) < M and remaining:
            # Take the closest remaining candidate
            best_dist, best_id = remaining.pop(0)
            selected.append(best_id)

            if not remaining:
                break

            # Remove candidates that are too close to the selected one
            # maintains diversity in the connections
            best_node = self.nodes[best_id]
            new_remaining = []

            for dist, node_id in remaining:
                if node_id not in self.nodes:
                    continue

                node = self.nodes[node_id]
                dist_to_selected = best_node.distance_to(node)

                # Keep if distance to query is better than distance to selected
                if dist < dist_to_selected:
                    new_remaining.append((dist, node_id))

            remaining = new_remaining

        # If we still need more neighbors, add remaining candidates
        while len(selected) < M and remaining:
            _, node_id = remaining.pop(0)
            selected.append(node_id)

        return selected

    def add_node(
        self,
        vector: np.ndarray,
        chunk_id: str,
        document_id: str,
        metadata: Dict[str, Any],
    ) -> str:
        """

        Args:
            vector: Embedding vector
            chunk_id: Unique chunk identifier
            document_id: Parent document ID
            metadata: Node metadata for filtering

        Returns:
            ID of the created node
        """
        level = self._select_level()

        node = HNSWNode(vector, chunk_id, document_id, metadata, level)
        self.nodes[node.id] = node

        for l in range(level + 1):
            self.layers[l].add(node.id)

        if level > self.max_layer:
            self.max_layer = level

        # If this is the first node, set as entry point
        if self.entry_point is None:
            self.entry_point = node.id
            self.size += 1
            return node.id

        # Search for closest nodes and add connections
        current_nearest = [self.entry_point]

        # Search from top layer down to level+1
        for lc in range(self.max_layer, level, -1):
            current_nearest = self._search_layer(vector, current_nearest, 1, lc)
            current_nearest = [node_id for _, node_id in current_nearest]

        # Search and connect from level down to 0
        for lc in range(min(level, self.max_layer), -1, -1):
            candidates = self._search_layer(
                vector, current_nearest, self.ef_construction, lc
            )

            # Select neighbors
            M = self.max_M0 if lc == 0 else self.max_M
            selected_neighbors = self._select_neighbors_heuristic(candidates, M, lc)

            # Add connections
            for neighbor_id in selected_neighbors:
                if neighbor_id in self.nodes:
                    node.add_connection(lc, neighbor_id)
                    self.nodes[neighbor_id].add_connection(lc, node.id)

            # Prune connections of neighbors if needed
            for neighbor_id in selected_neighbors:
                if neighbor_id not in self.nodes:
                    continue

                neighbor = self.nodes[neighbor_id]
                neighbor_connections = neighbor.get_connections(lc)

                max_conn = self.max_M0 if lc == 0 else self.max_M
                if len(neighbor_connections) > max_conn:
                    # Get all neighbor's neighbors and their distances
                    neighbor_candidates = []
                    for conn_id in neighbor_connections:
                        if conn_id in self.nodes:
                            dist = neighbor.distance_to(self.nodes[conn_id])
                            neighbor_candidates.append((dist, conn_id))

                    # Select best connections
                    new_connections = self._select_neighbors_heuristic(
                        neighbor_candidates, max_conn, lc
                    )

                    # Update connections
                    old_connections = neighbor_connections.copy()
                    neighbor.connections[lc] = set(new_connections)

                    # Remove links that were pruned
                    for old_conn_id in old_connections:
                        if (
                            old_conn_id not in new_connections
                            and old_conn_id in self.nodes
                        ):
                            self.nodes[old_conn_id].remove_connection(lc, neighbor_id)

                    # Add links for new connections
                    for new_conn_id in new_connections:
                        if new_conn_id in self.nodes:
                            self.nodes[new_conn_id].add_connection(lc, neighbor_id)

            current_nearest = selected_neighbors

        # Update entry point if necessary
        if level > self.max_layer:
            self.entry_point = node.id
            self.max_layer = level

        self.size += 1
        return node.id

    def search(
        self,
        query_vector: np.ndarray,
        k: int = 10,
        ef: Optional[int] = None,
        filters: Optional[Dict[str, Any]] = None,
        search_query: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Tuple[float, str, HNSWNode]]:
        """
        Args:
            query_vector: Query vector to search for
            k: Number of nearest neighbors to return
            ef: Search parameter (higher = more accurate, slower) but for the scale of an individual organizations search index, very unlikely we will run into any kind of speed performance issues
            filters: Optional metadata filters
            search_query: The original search query
            user_id: The user performing the search

        Returns:
            List of (distance, node_id, node) tuples
        """
        if not self.nodes or self.entry_point is None:
            return []

        if ef is None:
            ef = max(self.ef_construction, k)

        # Start from entry point
        current_nearest = [self.entry_point]

        # Search from top layer down to layer 1
        for lc in range(self.max_layer, 0, -1):
            current_nearest = self._search_layer(
                query_vector, current_nearest, 1, lc, None
            )
            current_nearest = [node_id for _, node_id in current_nearest]

        # Using a larger ef to get more candidates since filtering is done afterwards
        search_ef = max(ef, k * 3) if filters else ef
        candidates = self._search_layer(query_vector, current_nearest, search_ef, 0, None)

        filtered_results = []
        for distance, node_id in candidates:
            if node_id in self.nodes:
                node = self.nodes[node_id]
                # Skip deleted nodes
                if node.is_deleted:
                    continue

                if filters and not node.satisfies_filters(filters):
                    if (search_query and user_id and
                        self._should_log_group_denial(node, filters)):
                        group_id = node.metadata.get("groupId")
                        if group_id:
                            similarity_score = 1.0 / (1.0 + float(distance))

                            import asyncio
                            asyncio.create_task(self._log_group_access_denial(
                                user_id=user_id,
                                organization_id=self.organization_id,
                                search_query=search_query,
                                chunk_id=node.chunk_id,
                                document_id=node.document_id,
                                group_id=group_id,
                                similarity_score=similarity_score
                            ))
                    continue

                filtered_results.append((distance, node_id, node))

        return filtered_results[:k]

    def update_node_metadata(self, chunk_id: str, new_metadata: Dict[str, Any]) -> bool:
        """
        Update the metadata of a specific node identified by its chunk_id.

        Args:
            chunk_id: ID of the chunk whose node is being updated
            new_metadata: A dictionary containing the metadata fields to update

        Returns:
            True if the node was found and updated, False otherwise.
        """
        for node in self.nodes.values():
            if node.chunk_id == chunk_id:
                node.update_metadata(new_metadata)
                logger.info(
                    f"Updated metadata for node corresponding to chunk {chunk_id}"
                )
                return True

        logger.warning(f"Could not find node for chunk {chunk_id} to update metadata.")
        return False

    def set_node_metadata(self, chunk_id: str, new_metadata: Dict[str, Any]) -> bool:
        """
        Completely replace metadata for a node.

        Args:
            chunk_id: ID of the chunk whose node metadata is being replaced
            new_metadata: A dictionary containing the new metadata to set

        Returns:
            True if the node was found and updated, False otherwise.
        """
        for node in self.nodes.values():
            if node.chunk_id == chunk_id:
                node.set_metadata(new_metadata)
                logger.info(f"Set metadata for node corresponding to chunk {chunk_id}")
                return True

        logger.warning(f"Could not find node for chunk {chunk_id} to set metadata.")
        return False

    def delete_node_metadata_fields(
        self, chunk_id: str, fields_to_delete: List[str]
    ) -> bool:
        """
        Remove specific fields from a node's metadata.

        Args:
            chunk_id: ID of the chunk whose node metadata fields are being deleted
            fields_to_delete: List of field names to remove from metadata

        Returns:
            True if the node was found and fields were deleted, False otherwise.
        """
        for node in self.nodes.values():
            if node.chunk_id == chunk_id:
                node.delete_metadata_fields(fields_to_delete)
                logger.info(
                    f"Deleted metadata fields {fields_to_delete} for node corresponding to chunk {chunk_id}"
                )
                return True

        logger.warning(
            f"Could not find node for chunk {chunk_id} to delete metadata fields."
        )
        return False

    def remove_node(self, node_id: str) -> bool:
        if node_id not in self.nodes:
            return False

        node = self.nodes[node_id]

        # Remove all connections to this node
        for layer in range(node.max_layer + 1):
            for connected_id in node.get_connections(layer):
                if connected_id in self.nodes:
                    self.nodes[connected_id].remove_connection(layer, node_id)

            # Remove from layer
            self.layers[layer].discard(node_id)

        # Remove the node
        del self.nodes[node_id]
        self.size -= 1

        # Update entry point if necessary
        if node_id == self.entry_point:
            self._update_entry_point()

        return True

    def _update_entry_point(self) -> None:
        """Update entry point after removing the current one."""
        self.entry_point = None
        self.max_layer = 0

        # Find the node with the highest layer
        for node in self.nodes.values():
            if node.max_layer > self.max_layer:
                self.max_layer = node.max_layer
                self.entry_point = node.id

    def get_statistics(self) -> Dict[str, Any]:
        """Get index statistics."""
        layer_sizes = {}
        for layer, nodes in self.layers.items():
            layer_sizes[layer] = len(nodes)

        avg_connections_per_layer = {}
        for layer in range(self.max_layer + 1):
            if layer in self.layers and self.layers[layer]:
                total_connections = sum(
                    len(self.nodes[node_id].get_connections(layer))
                    for node_id in self.layers[layer]
                    if node_id in self.nodes
                )
                avg_connections_per_layer[layer] = total_connections / len(
                    self.layers[layer]
                )
            else:
                avg_connections_per_layer[layer] = 0

        return {
            "organization_id": self.organization_id,
            "total_nodes": self.size,
            "max_layer": self.max_layer,
            "entry_point": self.entry_point,
            "layer_sizes": layer_sizes,
            "avg_connections_per_layer": avg_connections_per_layer,
            "parameters": {
                "M": self.M,
                "ef_construction": self.ef_construction,
                "M_L": self.M_L,
            },
        }

    def clear(self) -> None:
        """Clear all nodes from the index."""
        self.nodes.clear()
        self.layers.clear()
        self.entry_point = None
        self.max_layer = 0
        self.size = 0

    def mark_deleted_by_chunk_id(self, chunk_id: str) -> bool:
        """
        Mark a node as deleted by its chunk_id.
        Can't do hard delete because we need to preserve graph connectivity
        """
        for node_id, node in self.nodes.items():
            if node.chunk_id == chunk_id:
                node.is_deleted = True
                logger.debug(
                    f"Marked node {node_id} with chunk_id {chunk_id} as deleted"
                )
                return True
        return False

    def save_to_disk(self, file_path: str):
        """
        TODO: Implement index persistence to disk.

        This method will save the entire HNSW graph to a file.
        using pickle for now to dump the entire object.
        TODO: Implement a custom binary format that we can save in S3
        """
        # For now, using pickle as a placeholder
        logger.info(f"Persisting index to {file_path}...")
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            pickle.dump(self, f)
        logger.info("Index persisted successfully.")

    @classmethod
    def load_from_disk(cls, file_path: str) -> "HNSWIndex":
        """
        TODO: Implement loading a persisted index from disk.

        This method will deserialize an index file and reconstruct the
        HNSWIndex object in memory
        """
        # using pickle as a placeholder
        logger.info(f"Loading index from {file_path}...")
        if not Path(file_path).exists():
            raise FileNotFoundError(f"No persisted index found at {file_path}")

        with open(file_path, "rb") as f:
            index = pickle.load(f)
        if not isinstance(index, cls):
            raise TypeError("Persisted object is not a valid HNSWIndex")

        logger.info(f"Index loaded successfully. Contains {index.size} nodes.")
        return index

    def _should_log_group_denial(self, node: HNSWNode, filters: Dict[str, Any]) -> bool:
        """
        Check if this denial should be logged
        """
        if "permissions" not in filters:
            return False

        permissions = filters["permissions"]
        user_role = permissions.get("userRole")
        user_groups = set(permissions.get("userGroupIds", []))

        doc_access_level = node.metadata.get("accessLevel")
        doc_group_id = node.metadata.get("groupId")

        return bool(doc_access_level == "GROUP" and
                    doc_group_id and
                    doc_group_id not in user_groups and
                    user_role != "ADMIN")

    async def _log_group_access_denial(
        self,
        user_id: str,
        organization_id: str,
        search_query: str,
        chunk_id: str,
        document_id: str,
        group_id: str,
        similarity_score: float
    ) -> None:

        try:
            await database_service.log_access_denial(
                organization_id=organization_id,
                user_id=user_id,
                search_query=search_query,
                chunk_id=chunk_id,
                document_id=document_id,
                group_id=group_id,
                access_level="GROUP",
                denial_reason="not_in_group",
                similarity_score=similarity_score
            )
            logger.debug(f"Logged group access denial for user {user_id}, chunk {chunk_id}, group {group_id}")
        except Exception as e:
            logger.error(f"Failed to log access denial: {e}")
