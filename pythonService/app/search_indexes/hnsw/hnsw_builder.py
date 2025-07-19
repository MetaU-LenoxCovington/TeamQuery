import logging
from typing import List, Dict, Any, Tuple
import numpy as np

from .hnsw_index import HNSWIndex

logger = logging.getLogger(__name__)


class HNSWBuilder:

    def __init__(
        self,
        organization_id: str,
        M: int = 16,
        ef_construction: int = 200,
        seed: int = None
    ):
        """
        Args:
            organization_id: Organization this index belongs to
            M: Maximum number of connections per node
            ef_construction: Construction parameter for search quality
            seed: Random seed for reproducibility
        """
        self.organization_id = organization_id
        self.M = M
        self.ef_construction = ef_construction
        self.seed = seed

    def build_index(
        self,
        vectors: List[np.ndarray],
        chunk_ids: List[str],
        document_ids: List[str],
        metadata_list: List[Dict[str, Any]],
        progress_callback: callable = None
    ) -> HNSWIndex:
        """
        Args:
            vectors: List of embedding vectors
            chunk_ids: List of chunk identifiers
            document_ids: List of document identifiers
            metadata_list: List of metadata dictionaries
            progress_callback: callback for progress updates ( probably not needed as
            the build will likely only take a few seconds at the most for indexes
            with only a few thousand documents. Time bottleneck is at docprocessing and chunking stage )

        Returns:
            HNSW index
        """
        if len(vectors) != len(chunk_ids) or len(vectors) != len(document_ids) or len(vectors) != len(metadata_list):
            raise ValueError("All input lists must have the same length")

        logger.info(f"Building HNSW index for organization {self.organization_id} with {len(vectors)} vectors")

        index = HNSWIndex(
            organization_id=self.organization_id,
            M=self.M,
            ef_construction=self.ef_construction,
            seed=self.seed
        )

        total = len(vectors)
        for i, (vector, chunk_id, document_id, metadata) in enumerate(zip(vectors, chunk_ids, document_ids, metadata_list)):
            try:
                index.add_node(vector, chunk_id, document_id, metadata)

                if progress_callback and (i + 1) % 100 == 0:
                    progress_callback(i + 1, total)

            except Exception as e:
                logger.error(f"Error adding node {chunk_id}: {e}")
                continue

        logger.info(f"HNSW index construction complete. Added {index.size} nodes.")

        if progress_callback:
            progress_callback(total, total)

        return index

    def rebuild_index(
        self,
        existing_index: HNSWIndex,
        new_vectors: List[np.ndarray],
        new_chunk_ids: List[str],
        new_document_ids: List[str],
        new_metadata_list: List[Dict[str, Any]],
        updated_metadata: List[Tuple[str, Dict[str, Any]]] = None,
        removed_chunk_ids: List[str] = None,
        progress_callback: callable = None
    ) -> HNSWIndex:
        """
        Rebuild index with additions and removals.

        Args:
            existing_index: Current index to update
            new_vectors: New vectors to add
            new_chunk_ids: New chunk IDs to add
            new_document_ids: New document IDs to add
            new_metadata_list: New metadata to add
            updated_metadata: List of (chunk_id, new_metadata_dict) tuples
            removed_chunk_ids: Chunk IDs to remove
            progress_callback: Progress callback function

        Returns:
            Updated index
        """
        logger.info(f"Rebuilding HNSW index for organization {self.organization_id}")

        # Update metadata first
        if updated_metadata:
            updated_count = 0
            for chunk_id, new_meta in updated_metadata:
                if existing_index.update_node_metadata(chunk_id, new_meta):
                    updated_count += 1
            logger.info(f"Updated metadata for {updated_count} nodes")

        # Remove nodes
        if removed_chunk_ids:
            removed_count = 0
            for chunk_id in removed_chunk_ids:
                # Find node by chunk_id
                node_to_remove = None
                for node_id, node in existing_index.nodes.items():
                    if node.chunk_id == chunk_id:
                        node_to_remove = node_id
                        break

                if node_to_remove:
                    existing_index.remove_node(node_to_remove)
                    removed_count += 1

            logger.info(f"Removed {removed_count} nodes from index")

        # Add new nodes
        if new_vectors:
            total_new = len(new_vectors)
            for i, (vector, chunk_id, document_id, metadata) in enumerate(zip(
                new_vectors, new_chunk_ids, new_document_ids, new_metadata_list
            )):
                try:
                    existing_index.add_node(vector, chunk_id, document_id, metadata)

                    if progress_callback and (i + 1) % 50 == 0:
                        progress_callback(i + 1, total_new)

                except Exception as e:
                    logger.error(f"Error adding new node {chunk_id}: {e}")
                    continue

            logger.info(f"Added {total_new} new nodes to index")

            if progress_callback:
                progress_callback(total_new, total_new)

        return existing_index

    def validate_index(self, index: HNSWIndex) -> Dict[str, Any]:
        logger.info(f"Validating HNSW index for organization {self.organization_id}")

        issues = []
        warnings = []

        if index.size == 0:
            issues.append("Index is empty")
            return {
                'valid': False,
                'issues': issues,
                'warnings': warnings,
                'statistics': {}
            }

        # Check entry point exists
        if not index.entry_point or index.entry_point not in index.nodes:
            issues.append("Invalid or missing entry point")

        orphaned_nodes = 0
        connection_issues = 0

        for node_id, node in index.nodes.items():
            # Check if node exists in layers
            node_in_layers = False
            for layer in range(node.max_layer + 1):
                if node_id in index.layers.get(layer, set()):
                    node_in_layers = True
                    break

            if not node_in_layers:
                orphaned_nodes += 1

            # Check connections
            for layer in range(node.max_layer + 1):
                for connected_id in node.get_connections(layer):
                    if connected_id not in index.nodes:
                        connection_issues += 1
                    elif not index.nodes[connected_id].has_connection(layer, node_id):
                        connection_issues += 1

        if orphaned_nodes > 0:
            issues.append(f"{orphaned_nodes} orphaned nodes found")

        if connection_issues > 0:
            issues.append(f"{connection_issues} connection inconsistencies found")

        if index.size > 10000 and index.ef_construction < 200:
            warnings.append("ef_construction may be too low for large index")

        # Layer distribution check
        layer_0_size = len(index.layers.get(0, set()))
        if layer_0_size < index.size * 0.8:
            warnings.append("Unusual layer 0 distribution, many nodes on higher layers")

        stats = index.get_statistics()

        validation_report = {
            'valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'statistics': stats,
            'node_count': index.size,
            'orphaned_nodes': orphaned_nodes,
            'connection_issues': connection_issues
        }

        if validation_report['valid']:
            logger.info("HNSW index validation passed")
        else:
            logger.warning(f"HNSW index validation failed: {issues}")

        return validation_report
