import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import asyncpg
import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class DatabaseService:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        if not self.pool:
            try:
                self.pool = await asyncpg.create_pool(
                    settings.DATABASE_URL, min_size=5, max_size=20, command_timeout=60
                )
                logger.info("Database connection pool created successfully")
            except Exception as e:
                logger.error(f"Failed to create database connection pool: {e}")
                raise

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("Database connection pool closed")

    async def get_chunks_and_embeddings_for_organization(
        self, organization_id: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch all non-deleted chunks and their embeddings for an organization.

        Returns:
            List of dicts containing chunk data with embeddings and metadata
        """
        query = """
            SELECT
                c.id as chunk_id,
                c.content,
                c.metadata as chunk_metadata,
                e.vector,
                e.id as embedding_id,
                d.id as document_id,
                d.title as document_title,
                d."accessLevel",
                d."groupId",
                d."restrictedToUsers",
                d.metadata as document_metadata
            FROM "Chunk" c
            INNER JOIN "Document" d ON c."documentId" = d.id
            LEFT JOIN "Embedding" e ON e."chunkId" = c.id
            WHERE
                c."organizationId" = $1
                AND c."isDeleted" = false
                AND d."isDeleted" = false
                AND (e."isDeleted" = false OR e."isDeleted" IS NULL)
            ORDER BY d.id, c.id
        """

        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, organization_id)

                results = []
                for row in rows:
                    # Prepare permission metadata for the search indexes
                    permission_metadata = {
                        "accessLevel": row["accessLevel"],
                        "groupId": row["groupId"],
                        "restrictedToUsers": row["restrictedToUsers"] or [],
                    }

                    # Combine all metadata
                    metadata = {
                        **(row["chunk_metadata"] or {}),
                        **(row["document_metadata"] or {}),
                        "document_title": row["document_title"],
                        **permission_metadata,
                    }

                    result = {
                        "chunk_id": row["chunk_id"],
                        "content": row["content"],
                        "document_id": row["document_id"],
                        "metadata": metadata,
                    }

                    # Convert embedding vector from bytes to numpy array if present
                    if row["vector"]:
                        result["embedding"] = np.frombuffer(
                            row["vector"], dtype=np.float32
                        )
                        result["embedding_id"] = row["embedding_id"]
                    else:
                        result["embedding"] = None
                        result["embedding_id"] = None

                    results.append(result)

                logger.info(
                    f"Fetched {len(results)} chunks for organization {organization_id}"
                )
                return results

        except Exception as e:
            logger.error(
                f"Failed to fetch chunks for organization {organization_id}: {e}"
            )
            raise

    async def get_organization_stats(self, organization_id: str) -> Dict[str, Any]:
        query = """
            SELECT
                COUNT(DISTINCT d.id) as document_count,
                COUNT(DISTINCT c.id) as chunk_count,
                COUNT(DISTINCT e.id) as embedding_count,
                o."lastIndexUpdate",
                o."lastDataChange"
            FROM "Organization" o
            LEFT JOIN "Document" d ON d."organizationId" = o.id AND d."isDeleted" = false
            LEFT JOIN "Chunk" c ON c."documentId" = d.id AND c."isDeleted" = false
            LEFT JOIN "Embedding" e ON e."chunkId" = c.id AND e."isDeleted" = false
            WHERE o.id = $1
            GROUP BY o.id, o."lastIndexUpdate", o."lastDataChange"
        """

        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(query, organization_id)
                if not row:
                    return None

                return {
                    "document_count": row["document_count"],
                    "chunk_count": row["chunk_count"],
                    "embedding_count": row["embedding_count"],
                    "last_index_update": row["lastIndexUpdate"],
                    "last_data_change": row["lastDataChange"],
                    "needs_reindex": (
                        row["lastIndexUpdate"] is None
                        or row["lastDataChange"] > row["lastIndexUpdate"]
                    ),
                }
        except Exception as e:
            logger.error(f"Failed to get organization stats: {e}")
            raise

    async def update_last_index_time(self, organization_id: str):
        """Update the last index update time for an organization"""
        query = """
            UPDATE "Organization"
            SET "lastIndexUpdate" = NOW()
            WHERE id = $1
        """

        try:
            async with self.pool.acquire() as conn:
                await conn.execute(query, organization_id)
                logger.info(
                    f"Updated last index time for organization {organization_id}"
                )
        except Exception as e:
            logger.error(f"Failed to update last index time: {e}")
            raise

    async def save_chunk(
        self, chunk_data: Dict[str, Any], document_id: str, organization_id: str
    ) -> str:
        query = """
            INSERT INTO "Chunk" (
                id, "documentId", "organizationId", content, metadata, "isDeleted",
                "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
            RETURNING id
        """

        try:
            import uuid

            chunk_id = str(uuid.uuid4())

            async with self.pool.acquire() as conn:
                await conn.execute(
                    query,
                    chunk_id,
                    document_id,
                    organization_id,
                    chunk_data["content"],
                    json.dumps(chunk_data.get("metadata", {})),
                )
                return chunk_id
        except Exception as e:
            logger.error(f"Failed to save chunk: {e}")
            raise

    async def save_embedding(
        self,
        embedding_vector: np.ndarray,
        chunk_id: str,
        document_id: str,
        organization_id: str,
        model_name: str = "default",
    ) -> str:
        query = """
            INSERT INTO "Embedding" (
                id, "chunkId", "documentId", "organizationId", vector, "isDeleted",
                "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
            RETURNING id
        """

        try:
            import uuid

            embedding_id = str(uuid.uuid4())

            # Convert numpy array to bytes
            vector_bytes = embedding_vector.astype(np.float32).tobytes()

            async with self.pool.acquire() as conn:
                await conn.execute(
                    query,
                    embedding_id,
                    chunk_id,
                    document_id,
                    organization_id,
                    vector_bytes,
                )
                return embedding_id
        except Exception as e:
            logger.error(f"Failed to save embedding: {e}")
            raise

    async def mark_chunks_deleted(self, organization_id: str, chunk_ids: List[str]):
        query = """
            UPDATE "Chunk"
            SET "isDeleted" = true, "updatedAt" = NOW()
            WHERE id = ANY($1) AND "organizationId" = $2
        """

        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(query, chunk_ids, organization_id)
                # Extract number of affected rows from result
                affected_rows = int(result.split()[-1]) if result else 0
                logger.info(
                    f"Marked {affected_rows} chunks as deleted for organization {organization_id}"
                )
        except Exception as e:
            logger.error(f"Failed to mark chunks as deleted: {e}")
            raise

    async def mark_embeddings_deleted(
        self, organization_id: str, embedding_ids: List[str]
    ):
        query = """
            UPDATE "Embedding"
            SET "isDeleted" = true, "updatedAt" = NOW()
            WHERE id = ANY($1) AND "organizationId" = $2
        """

        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(query, embedding_ids, organization_id)
                # Extract number of affected rows from result
                affected_rows = int(result.split()[-1]) if result else 0
                logger.info(
                    f"Marked {affected_rows} embeddings as deleted for organization {organization_id}"
                )
        except Exception as e:
            logger.error(f"Failed to mark embeddings as deleted: {e}")
            raise

database_service = DatabaseService()
