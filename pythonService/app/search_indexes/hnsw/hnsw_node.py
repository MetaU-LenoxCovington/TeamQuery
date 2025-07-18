import uuid
from typing import Dict, List, Set, Any, Optional
import numpy as np


class HNSWNode:

    def __init__(
        self,
        vector: np.ndarray,
        chunk_id: str,
        document_id: str,
        metadata: Dict[str, Any],
        max_layer: int = 0
    ):
        """
        Args:
            vector: The embedding vector for this node
            chunk_id: id for the chunk
            document_id: id of the document the chunk belongs to
            metadata: Metadata for filtering (access_level, group_ids, etc.)
            max_layer: Highest layer this node exists on
        """
        self.id = str(uuid.uuid4())
        self.vector = vector.astype(np.float32)
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.metadata = metadata
        self.max_layer = max_layer

        # Connections organized by layer
        self.connections: Dict[int, Set[str]] = {i: set() for i in range(max_layer + 1)}

        # Cache for distance calculations
        self._distance_cache: Dict[str, float] = {}

    def add_connection(self, layer: int, node_id: str) -> None:
        """Add a connection to another node at a specific layer."""
        if layer <= self.max_layer:
            self.connections[layer].add(node_id)

    def remove_connection(self, layer: int, node_id: str) -> None:
        """Remove a connection to another node at a specific layer."""
        if layer in self.connections:
            self.connections[layer].discard(node_id)

    def get_connections(self, layer: int) -> Set[str]:
        """Get all connections at a specific layer."""
        return self.connections.get(layer, set())

    def has_connection(self, layer: int, node_id: str) -> bool:
        """Check if this node is connected to another node at a specific layer."""
        return node_id in self.connections.get(layer, set())

    def distance_to(self, other: 'HNSWNode') -> float:
        """
        Calculate cosine distance to another node
        """
        if other.id in self._distance_cache:
            return self._distance_cache[other.id]

        # Cosine distance = 1 - cosine_similarity
        dot_product = np.dot(self.vector, other.vector)
        norm_self = np.linalg.norm(self.vector)
        norm_other = np.linalg.norm(other.vector)

        if norm_self == 0 or norm_other == 0:
            distance = 1.0
        else:
            cosine_similarity = dot_product / (norm_self * norm_other)
            distance = 1.0 - cosine_similarity

        # Cache result
        self._distance_cache[other.id] = distance
        return distance

    def distance_to_vector(self, vector: np.ndarray) -> float:
        """Calculate cosine distance to the query vector"""
        dot_product = np.dot(self.vector, vector)
        norm_self = np.linalg.norm(self.vector)
        norm_vector = np.linalg.norm(vector)

        if norm_self == 0 or norm_vector == 0:
            return 1.0

        cosine_similarity = dot_product / (norm_self * norm_vector)
        return 1.0 - cosine_similarity

    def satisfies_filters(self, filters: Dict[str, Any]) -> bool:
        """
        Check if this node satisfies the given metadata filters.

        Args:
            filters: Dictionary of filter conditions

        Returns:
            True if the node matches all filter conditions
        """
        for key, expected_value in filters.items():
            if key not in self.metadata:
                return False

            actual_value = self.metadata[key]

            # Handle different filter types
            if isinstance(expected_value, dict):
                # Range or operator-based filters
                if '$in' in expected_value:
                    if actual_value not in expected_value['$in']:
                        return False
                elif '$gte' in expected_value:
                    if actual_value < expected_value['$gte']:
                        return False
                elif '$lte' in expected_value:
                    if actual_value > expected_value['$lte']:
                        return False
                elif '$ne' in expected_value:
                    if actual_value == expected_value['$ne']:
                        return False
            elif isinstance(expected_value, list):
                if actual_value not in expected_value:
                    return False
            else:
                if actual_value != expected_value:
                    return False

        return True

    def clear_cache(self) -> None:
        self._distance_cache.clear()

    def __repr__(self) -> str:
        return f"HNSWNode(id={self.id[:8]}, chunk_id={self.chunk_id}, max_layer={self.max_layer})"

    def __eq__(self, other) -> bool:
        if not isinstance(other, HNSWNode):
            return False
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)
