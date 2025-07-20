import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import numpy as np
from app.search_indexes.hnsw import HNSWBuilder, HNSWIndex

from app.services.database_service import database_service

# TODO: Uncomment when BM25 and Inverted index are implemented
# from app.search_indexes.bm25 import BM25Index
# from app.search_indexes.inverted import InvertedIndex

logger = logging.getLogger(__name__)


@dataclass
class OrganizationIndexes:
    organization_id: str
    hnsw_index: Optional[HNSWIndex] = None
    # bm25_index: Optional[BM25Index] = None
    # inverted_index: Optional[InvertedIndex] = None
    last_updated: Optional[datetime] = None
    is_building: bool = False
    chunk_count: int = 0
    document_count: int = 0


class SearchIndexBuilderService:
    """
    Manages the lifecycle of search indexes for all organizations.
    Builds, updates, and destroys indexes as needed.
    """

    def __init__(self):
        self.indexes: Dict[str, OrganizationIndexes] = {}

        # Track organizations currently being built to prevent duplicates
        self.building_locks: Dict[str, asyncio.Lock] = {}

        # HNSW parameters
        self.hnsw_m = 16
        self.hnsw_ef_construction = 200

    async def build_or_update_index(
        self, organization_id: str, force_rebuild: bool = False
    ) -> OrganizationIndexes:
        """
        Args:
            organization_id: The organization to build indexes for
            force_rebuild: If True, rebuild even if indexes exist

        Returns:
            The organization's indexes
        """
        # Get or create lock for this organization
        if organization_id not in self.building_locks:
            self.building_locks[organization_id] = asyncio.Lock()

        async with self.building_locks[organization_id]:
            # Check if we need to build/rebuild
            org_stats = await database_service.get_organization_stats(organization_id)
            if not org_stats:
                raise ValueError(f"Organization {organization_id} not found")

            existing_indexes = self.indexes.get(organization_id)
            needs_rebuild = (
                force_rebuild
                or not existing_indexes
                or not existing_indexes.hnsw_index
                or org_stats["needs_reindex"]
            )

            if not needs_rebuild:
                logger.info(
                    f"Indexes for organization {organization_id} are up to date. "
                    f"Documents: {org_stats['document_count']}, Chunks: {org_stats['chunk_count']}"
                )
                return existing_indexes

            # Create new index container
            org_indexes = OrganizationIndexes(
                organization_id=organization_id, is_building=True
            )

            try:
                logger.info(f"Building indexes for organization {organization_id}")

                chunks_data = (
                    await database_service.get_chunks_and_embeddings_for_organization(
                        organization_id
                    )
                )

                if not chunks_data:
                    logger.warning(
                        f"No chunks found for organization {organization_id}"
                    )
                    org_indexes.is_building = False
                    org_indexes.last_updated = datetime.utcnow()
                    self.indexes[organization_id] = org_indexes
                    return org_indexes

                # Separate chunks with embeddings from those without
                chunks_with_embeddings = [
                    c for c in chunks_data if c.get("embedding") is not None
                ]
                chunks_without_embeddings = [
                    c for c in chunks_data if c.get("embedding") is None
                ]

                if chunks_without_embeddings:
                    logger.warning(
                        f"Found {len(chunks_without_embeddings)} chunks without embeddings "
                        f"for organization {organization_id}. These will be excluded from vector search."
                    )

                # Build HNSW index
                if chunks_with_embeddings:
                    org_indexes.hnsw_index = await self._build_hnsw_index(
                        organization_id, chunks_with_embeddings
                    )
                    logger.info(
                        f"Built HNSW index with {len(chunks_with_embeddings)} vectors "
                        f"for organization {organization_id}"
                    )

                # TODO: Build BM25 index
                # org_indexes.bm25_index = await self._build_bm25_index(
                #     organization_id, chunks_data
                # )

                # TODO: Build Inverted index
                # org_indexes.inverted_index = await self._build_inverted_index(
                #     organization_id, chunks_data
                # )

                org_indexes.chunk_count = len(chunks_data)
                org_indexes.document_count = len(
                    set(c["document_id"] for c in chunks_data)
                )
                org_indexes.is_building = False
                org_indexes.last_updated = datetime.utcnow()

                # Store in memory
                self.indexes[organization_id] = org_indexes

                await database_service.update_last_index_time(organization_id)

                logger.info(
                    f"Successfully built indexes for organization {organization_id}. "
                    f"Documents: {org_indexes.document_count}, Chunks: {org_indexes.chunk_count}"
                )

                return org_indexes

            except Exception as e:
                logger.error(
                    f"Failed to build indexes for organization {organization_id}: {e}"
                )
                org_indexes.is_building = False
                raise

    async def _build_hnsw_index(
        self, organization_id: str, chunks_with_embeddings: List[Dict[str, Any]]
    ) -> HNSWIndex:
        builder = HNSWBuilder(
            organization_id=organization_id,
            M=self.hnsw_m,
            ef_construction=self.hnsw_ef_construction,
        )

        for chunk in chunks_with_embeddings:
            builder.add_node(
                vector=chunk["embedding"],
                chunk_id=chunk["chunk_id"],
                document_id=chunk["document_id"],
                metadata=chunk["metadata"],
            )

        return builder.build()

    async def add_chunks(
        self, organization_id: str, new_chunks: List[Dict[str, Any]]
    ) -> bool:
        """
        Add new chunks to existing indexes.

        Args:
            organization_id: The organization ID
            new_chunks: List of chunk data with embeddings and metadata

        Returns:
            True if successful
        """
        org_indexes = self.indexes.get(organization_id)
        if not org_indexes:
            logger.warning(
                f"No indexes found for organization {organization_id}. "
                "Building new indexes."
            )
            await self.build_or_update_index(organization_id)
            org_indexes = self.indexes.get(organization_id)

        # Add to HNSW index
        if org_indexes.hnsw_index:
            chunks_with_embeddings = [
                c for c in new_chunks if c.get("embedding") is not None
            ]
            for chunk in chunks_with_embeddings:
                org_indexes.hnsw_index.add_node(
                    vector=chunk["embedding"],
                    chunk_id=chunk["chunk_id"],
                    document_id=chunk["document_id"],
                    metadata=chunk["metadata"],
                )
            logger.info(
                f"Added {len(chunks_with_embeddings)} chunks to HNSW index "
                f"for organization {organization_id}"
            )

        # TODO: Add to BM25 and Inverted indexes

        org_indexes.chunk_count += len(new_chunks)

        return True

    async def remove_chunks(self, organization_id: str, chunk_ids: List[str]) -> bool:
        """
        soft delete

        Args:
            organization_id: The organization ID
            chunk_ids: List of chunk IDs to remove

        Returns:
            True if successful
        """
        org_indexes = self.indexes.get(organization_id)
        if not org_indexes:
            logger.warning(f"No indexes found for organization {organization_id}")
            return False

        # Remove from HNSW index
        if org_indexes.hnsw_index:
            removed_count = 0
            for chunk_id in chunk_ids:
                if org_indexes.hnsw_index.mark_deleted_by_chunk_id(chunk_id):
                    removed_count += 1
            logger.info(
                f"Marked {removed_count} chunks as deleted in HNSW index "
                f"for organization {organization_id}"
            )

        # TODO: Remove from BM25 and Inverted indexes

        return True

    async def update_chunk_metadata(
        self, organization_id: str, chunk_updates: List[Dict[str, Any]]
    ) -> bool:
        """
        Update metadata(permissions, upload time, etc) for existing chunk.

        Args:
            organization_id: The organization ID
            chunk_updates: List of dicts with chunk_id and new metadata

        Returns:
            True if successful
        """
        org_indexes = self.indexes.get(organization_id)
        if not org_indexes:
            logger.warning(f"No indexes found for organization {organization_id}")
            return False

        # Update HNSW index metadata
        if org_indexes.hnsw_index:
            updated_count = 0
            for update in chunk_updates:
                chunk_id = update["chunk_id"]
                new_metadata = update["metadata"]
                if org_indexes.hnsw_index.update_metadata_by_chunk_id(
                    chunk_id, new_metadata
                ):
                    updated_count += 1
            logger.info(
                f"Updated metadata for {updated_count} chunks in HNSW index "
                f"for organization {organization_id}"
            )

        # TODO: Update BM25 and Inverted indexes

        return True

    def get_indexes(self, organization_id: str) -> Optional[OrganizationIndexes]:
        return self.indexes.get(organization_id)

    def has_indexes(self, organization_id: str) -> bool:
        org_indexes = self.indexes.get(organization_id)
        return (
            org_indexes is not None
            and org_indexes.hnsw_index is not None
            and not org_indexes.is_building
        )

    def destroy_indexes(self, organization_id: str) -> bool:
        """
        Remove all indexes for an organization from memory.
        """
        if organization_id in self.indexes:
            logger.info(f"Destroying indexes for organization {organization_id}")
            del self.indexes[organization_id]
            return True
        return False

    def get_stats(self) -> Dict[str, Any]:
        stats = {"total_organizations": len(self.indexes), "organizations": {}}

        for org_id, org_indexes in self.indexes.items():
            stats["organizations"][org_id] = {
                "chunk_count": org_indexes.chunk_count,
                "document_count": org_indexes.document_count,
                "last_updated": (
                    org_indexes.last_updated.isoformat()
                    if org_indexes.last_updated
                    else None
                ),
                "is_building": org_indexes.is_building,
                "has_hnsw": org_indexes.hnsw_index is not None,
                # "has_bm25": org_indexes.bm25_index is not None,
                # "has_inverted": org_indexes.inverted_index is not None
            }

        return stats


search_index_builder = SearchIndexBuilderService()
