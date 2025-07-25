import json
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from datetime import datetime
import time

from app.services.search_index_builder_service import search_index_builder
from app.services.embedding_service import embedding_service
from app.services.database_service import database_service

logger = logging.getLogger(__name__)


class SearchResult:
    def __init__(
        self,
        chunk_id: str,
        document_id: str,
        content: str,
        score: float,
        metadata: Dict[str, Any],
        source: str = "hnsw"
    ):
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.content = content
        self.score = score
        self.metadata = metadata
        self.source = source


class SearchService:

    def __init__(self):
        self.default_k = 10
        self.max_k = 100

    async def search(
        self,
        query: str,
        organization_id: str,
        filters: Optional[Dict[str, Any]] = None,
        k: int = None
    ) -> Dict[str, Any]:
        """
        Args:
            query: The search query
            organization_id: The organization to search in
            filters: Permission and metadata filters
            k: Number of results to return

        Returns:
            Search results with metadata
        """
        start_time = time.time()
        k = min(k or self.default_k, self.max_k)

        org_indexes = search_index_builder.get_indexes(organization_id)
        if not org_indexes or not org_indexes.hnsw_index:
            logger.info(f"No indexes found for organization {organization_id}, building...")
            org_indexes = await search_index_builder.build_or_update_index(organization_id)

            if not org_indexes or not org_indexes.hnsw_index:
                return {
                    "query": query,
                    "results": [],
                    "total_results": 0,
                    "processing_time": time.time() - start_time,
                    "error": "No searchable content found for this organization"
                }

        parsed_filters = self._parse_filters(filters)

        results = []

        # HNSW Vector Search
        if org_indexes.hnsw_index:
            hnsw_results = await self._search_hnsw(
                query, org_indexes.hnsw_index, parsed_filters, k * 2
            )
            results.extend(hnsw_results)

        # TODO: Add BM25 search when implemented

        # Sort by score and take top k
        # replace with RRF when implemented
        results.sort(key=lambda x: x.score, reverse=True)
        results = results[:k]

        # Fetch full content for results
        final_results = await self._enrich_results(results)

        processing_time = time.time() - start_time

        return {
            "query": query,
            "results": final_results,
            "total_results": len(final_results),
            "processing_time": processing_time,
            "indexes_used": {
                "hnsw": org_indexes.hnsw_index is not None,
                "bm25": False,  # TODO: Update when implemented
            }
        }

    def _parse_filters(self, filters: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Parse and validate all filters from the request (permissions + metadata)"""
        if not filters:
            return {}

        parsed_filters = {}

        if "permissions" in filters:
            permissions = filters["permissions"]
            parsed_filters["permissions"] = {
                "userId": permissions.get("userId"),
                "userRole": permissions.get("userRole"),
                "userGroupIds": permissions.get("userGroupIds", [])
            }

        if "metadata" in filters:
            metadata_filters = filters["metadata"]
            # Pass through metadata filters as-is for now
            # The HNSW nodes will handle the specific filter logic
            for key, value in metadata_filters.items():
                parsed_filters[key] = value

        return parsed_filters

    async def _search_hnsw(
        self,
        query: str,
        hnsw_index: Any,
        filters: Dict[str, Any],
        k: int
    ) -> List[SearchResult]:
        try:
            query_embedding = await embedding_service.generate_embedding(query)
            if query_embedding is None:
                logger.error("Failed to generate query embedding")
                return []

            logger.debug(f"Generated query embedding for '{query}' with {len(query_embedding)} dimensions")
            logger.debug(f"Searching HNSW index with filters: {filters}")

            user_id = None
            if filters and "permissions" in filters:
                user_id = filters["permissions"].get("userId")

            search_results = hnsw_index.search(
                query_vector=query_embedding,
                k=k,
                filters=filters,
                search_query=query,
                user_id=user_id
            )

            logger.debug(f"HNSW index returned {len(search_results)} raw candidates")

            results = []
            for distance, node_id, node in search_results:
                # This is just a double check, the HNSW index should already filter
                if node.is_deleted:
                    logger.debug(f"Skipping deleted node {node_id}")
                    continue

                result = SearchResult(
                    chunk_id=node.chunk_id,
                    document_id=node.document_id,
                    content="",  # Will be filled in later
                    score=1.0 / (1.0 + float(distance)),  # Convert distance to score, higher is better
                    metadata=node.metadata,
                    source="hnsw"
                )
                results.append(result)
                logger.debug(f"Added result: chunk_id={node.chunk_id}, distance={distance:.4f}, score={result.score:.4f}")

            logger.info(f"HNSW search returned {len(results)} results for query: {query}")
            return results

        except Exception as e:
            logger.error(f"Error in HNSW search: {e}")
            return []

    async def _enrich_results(self, results: List[SearchResult]) -> List[Dict[str, Any]]:
        """Fetch full content for search results from the database"""
        if not results:
            return []

        chunk_ids = list(set(r.chunk_id for r in results))

        query = """
            SELECT
                c.id as chunk_id,
                c.content,
                c.metadata as chunk_metadata,
                d.title as document_title,
                d."s3Key" as s3_key,
                d."originalFileName" as original_filename
            FROM "Chunk" c
            INNER JOIN "Document" d ON c."documentId" = d.id
            WHERE c.id = ANY($1)
        """

        try:
            async with database_service.pool.acquire() as conn:
                rows = await conn.fetch(query, chunk_ids)

                chunk_content_map = {}
                for row in rows:
                    chunk_metadata = row["chunk_metadata"]
                    if isinstance(chunk_metadata, str):
                        try:
                            chunk_metadata = json.loads(chunk_metadata)
                        except (json.JSONDecodeError, TypeError):
                            chunk_metadata = {}
                    elif chunk_metadata is None:
                        chunk_metadata = {}

                    chunk_content_map[row["chunk_id"]] = {
                        "content": row["content"],
                        "document_title": row["document_title"],
                        "original_filename": row["original_filename"],
                        "chunk_metadata": chunk_metadata
                    }

            enriched_results = []
            for result in results:
                chunk_data = chunk_content_map.get(result.chunk_id)
                if not chunk_data:
                    logger.warning(f"No content found for chunk {result.chunk_id}")
                    continue

                enriched_results.append({
                    "chunk_id": result.chunk_id,
                    "document_id": result.document_id,
                    "content": chunk_data["content"],
                    "score": result.score,
                    "metadata": {
                        **result.metadata,
                        **chunk_data["chunk_metadata"],
                        "document_title": chunk_data["document_title"],
                        "original_filename": chunk_data["original_filename"]
                    },
                    "source": result.source
                })

            return enriched_results

        except Exception as e:
            logger.error(f"Error enriching search results: {e}")
            return [
                {
                    "chunk_id": r.chunk_id,
                    "document_id": r.document_id,
                    "content": r.content,
                    "score": r.score,
                    "metadata": r.metadata,
                    "source": r.source
                }
                for r in results
            ]

    def check_permissions(
        self,
        node_metadata: Dict[str, Any],
        user_permissions: Dict[str, Any]
    ) -> bool:
        """
        Check if a user has permission to access a node based on metadata.
        This is a backup check since the HNSW index should already filter

        Args:
            node_metadata: Metadata from the node including access level
            user_permissions: User's permission context

        Returns:
            True if user has access, False otherwise
        """
        # Admin users can see everything
        if user_permissions.get("user_role") == "ADMIN":
            return True

        access_level = node_metadata.get("accessLevel", "PUBLIC")

        # PUBLIC - all organization members can read
        if access_level == "PUBLIC":
            return True

        # GROUP - check if user is in the group
        if access_level == "GROUP":
            group_id = node_metadata.get("groupId")
            if group_id and group_id in user_permissions.get("user_group_ids", []):
                return True
            return False

        # MANAGERS - only managers and admins
        if access_level == "MANAGERS":
            return user_permissions.get("user_role") in ["MANAGER", "ADMIN"]

        # ADMINS - only admins
        if access_level == "ADMINS":
            return False

        # RESTRICTED - check if user is in the restricted list
        if access_level == "RESTRICTED":
            restricted_users = node_metadata.get("restrictedToUsers", [])
            user_id = user_permissions.get("user_id")
            return user_id and user_id in restricted_users

        # Default deny
        return False

    def cleanup(self) -> None:
        logger.info("Cleaning up SearchService")
        try:
            logger.debug("SearchService cleanup completed")
        except Exception as e:
            logger.warning(f"Error during SearchService cleanup: {e}")

search_service = SearchService()
