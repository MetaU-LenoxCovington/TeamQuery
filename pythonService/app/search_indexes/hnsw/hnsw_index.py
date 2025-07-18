import random
import heapq
import math
from typing import Dict, List, Set, Tuple, Optional, Any
import numpy as np
from collections import defaultdict

from .hnsw_node import HNSWNode


class HNSWIndex:

    def __init__(
        self,
        organization_id: str,
        M: int = 16,
        ef_construction: int = 200,
        M_L: float = 1 / math.log(2.0),
        seed: int = None
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
        filters: Optional[Dict[str, Any]] = None
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

            # Apply filters if provided
            if filters and not ep_node.satisfies_filters(filters):
                continue

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

                # Apply filters if provided
                if filters and not neighbor_node.satisfies_filters(filters):
                    continue

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
        keep_pruned_connections: bool = True
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
        metadata: Dict[str, Any]
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
            current_nearest = self._search_layer(
                vector, current_nearest, 1, lc
            )
            current_nearest = [node_id for _, node_id in current_nearest]

        # Search and connect from level down to 0
        for lc in range(min(level, self.max_layer), -1, -1):
            candidates = self._search_layer(
                vector, current_nearest, self.ef_construction, lc
            )

            # Select neighbors
            M = self.max_M0 if lc == 0 else self.max_M
            selected_neighbors = self._select_neighbors_heuristic(
                candidates, M, lc
            )

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
                        if old_conn_id not in new_connections and old_conn_id in self.nodes:
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
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Tuple[float, str, str]]:
        """
        Args:
            query_vector: Query vector to search for
            k: Number of nearest neighbors to return
            ef: Search parameter (higher = more accurate, slower) but for the scale of an individual organizations search index, very unlikely we will run into any kind of speed performance issues
            filters: Optional metadata filters

        Returns:
            List of (distance, node_id, chunk_id) tuples
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
                query_vector, current_nearest, 1, lc, filters
            )
            current_nearest = [node_id for _, node_id in current_nearest]

        # Search layer 0 with ef
        candidates = self._search_layer(
            query_vector, current_nearest, ef, 0, filters
        )

        # Return top k results
        results = []
        for distance, node_id in candidates[:k]:
            if node_id in self.nodes:
                node = self.nodes[node_id]
                results.append((distance, node_id, node.chunk_id))

        return results

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
                avg_connections_per_layer[layer] = total_connections / len(self.layers[layer])
            else:
                avg_connections_per_layer[layer] = 0

        return {
            'organization_id': self.organization_id,
            'total_nodes': self.size,
            'max_layer': self.max_layer,
            'entry_point': self.entry_point,
            'layer_sizes': layer_sizes,
            'avg_connections_per_layer': avg_connections_per_layer,
            'parameters': {
                'M': self.M,
                'ef_construction': self.ef_construction,
                'M_L': self.M_L
            }
        }

    def clear(self) -> None:
        """Clear all nodes from the index."""
        self.nodes.clear()
        self.layers.clear()
        self.entry_point = None
        self.max_layer = 0
        self.size = 0
