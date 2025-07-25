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

                    chunk_metadata = row["chunk_metadata"]
                    if isinstance(chunk_metadata, str):
                        try:
                            chunk_metadata = json.loads(chunk_metadata)
                        except (json.JSONDecodeError, TypeError):
                            chunk_metadata = {}
                    elif chunk_metadata is None:
                        chunk_metadata = {}

                    document_metadata = row["document_metadata"]
                    if isinstance(document_metadata, str):
                        try:
                            document_metadata = json.loads(document_metadata)
                        except (json.JSONDecodeError, TypeError):
                            document_metadata = {}
                    elif document_metadata is None:
                        document_metadata = {}

                    # Combine all metadata
                    metadata = {
                        **chunk_metadata,
                        **document_metadata,
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

    async def has_embeddings_for_document(self, document_id: str) -> bool:
        if not self.pool:
            await self.connect()

        query = """
            SELECT EXISTS(
                SELECT 1
                FROM "Embedding" e
                INNER JOIN "Chunk" c ON e."chunkId" = c.id
                INNER JOIN "Document" d ON c."documentId" = d.id
                WHERE
                    d.id = $1
                    AND e."isDeleted" = false
                    AND c."isDeleted" = false
                    AND d."isDeleted" = false
            ) as has_embeddings
        """

        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(query, document_id)
                has_embeddings = row["has_embeddings"] if row else False

                logger.info(f"Document {document_id} has embeddings: {has_embeddings}")
                return has_embeddings

        except Exception as e:
            logger.error(f"Failed to check embeddings for document {document_id}: {e}")
            raise

    async def get_chunks_by_document_id(self, document_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a specific document by document ID"""
        if not self.pool:
            await self.connect()

        query = """
            SELECT
                c.id as chunk_id,
                c.content,
                c.metadata as chunk_metadata,
                c."createdAt",
                c."updatedAt",
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
            LEFT JOIN "Embedding" e ON e."chunkId" = c.id AND e."isDeleted" = false
            WHERE
                c."documentId" = $1
                AND c."isDeleted" = false
                AND d."isDeleted" = false
            ORDER BY c."createdAt"
        """

        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, document_id)

                if not rows:
                    logger.info(f"No chunks found for document {document_id}")
                    return []

                results = []
                for row in rows:
                    # Parse chunk metadata
                    chunk_metadata = row["chunk_metadata"]
                    if isinstance(chunk_metadata, str):
                        try:
                            chunk_metadata = json.loads(chunk_metadata)
                        except (json.JSONDecodeError, TypeError):
                            chunk_metadata = {}
                    elif chunk_metadata is None:
                        chunk_metadata = {}

                    # Parse document metadata
                    document_metadata = row["document_metadata"]
                    if isinstance(document_metadata, str):
                        try:
                            document_metadata = json.loads(document_metadata)
                        except (json.JSONDecodeError, TypeError):
                            document_metadata = {}
                    elif document_metadata is None:
                        document_metadata = {}

                    # Prepare permission metadata
                    permission_metadata = {
                        "accessLevel": row["accessLevel"],
                        "groupId": row["groupId"],
                        "restrictedToUsers": row["restrictedToUsers"] or [],
                    }

                    # Combine all metadata
                    combined_metadata = {
                        **chunk_metadata,
                        **document_metadata,
                        "document_title": row["document_title"],
                        **permission_metadata,
                    }

                    chunk_result = {
                        "chunk_id": row["chunk_id"],
                        "content": row["content"],
                        "document_id": row["document_id"],
                        "metadata": combined_metadata,
                        "createdAt": row["createdAt"],
                        "updatedAt": row["updatedAt"]
                    }

                    # Convert embedding vector from bytes to numpy array if present
                    if row["vector"]:
                        chunk_result["embedding"] = np.frombuffer(
                            row["vector"], dtype=np.float32
                        )
                        chunk_result["embedding_id"] = row["embedding_id"]
                    else:
                        chunk_result["embedding"] = None
                        chunk_result["embedding_id"] = None

                    results.append(chunk_result)

                logger.info(f"Retrieved {len(results)} chunks for document {document_id}")
                return results

        except Exception as e:
            logger.error(f"Failed to get chunks for document {document_id}: {e}")
            raise

    async def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        if not self.pool:
            await self.connect()

        query = """
            SELECT
                id, "organizationId", title, "accessLevel", "groupId",
                "restrictedToUsers", metadata, "isDeleted", "createdAt", "updatedAt"
            FROM "Document"
            WHERE id = $1 AND "isDeleted" = false
        """

        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(query, document_id)

                if not row:
                    logger.info(f"Document {document_id} not found or is deleted")
                    return None

                # Parse metadata if it's a JSON string
                metadata = row["metadata"]
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except (json.JSONDecodeError, TypeError):
                        metadata = {}
                elif metadata is None:
                    metadata = {}

                document = {
                    "id": row["id"],
                    "organizationId": row["organizationId"],
                    "title": row["title"],
                    "accessLevel": row["accessLevel"],
                    "groupId": row["groupId"],
                    "restrictedToUsers": row["restrictedToUsers"] or [],
                    "metadata": metadata,
                    "isDeleted": row["isDeleted"],
                    "createdAt": row["createdAt"],
                    "updatedAt": row["updatedAt"]
                }

                logger.info(f"Retrieved document {document_id} from database")
                return document

        except Exception as e:
            logger.error(f"Failed to get document {document_id}: {e}")
            raise

    async def save_document(
        self, document_id: str, organization_id: str, document_metadata: Dict[str, Any]
    ) -> str:
        """Save a document record to the database"""
        query = """
            INSERT INTO "Document" (
                id, "organizationId", title, "accessLevel", "groupId",
                "restrictedToUsers", metadata, "isDeleted", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
            RETURNING id
        """

        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    query,
                    document_id,
                    organization_id,
                    document_metadata.get("title", "Untitled"),
                    document_metadata.get("accessLevel", "GROUP"),
                    document_metadata.get("groupId"),
                    document_metadata.get("restrictedToUsers", []),
                    json.dumps(document_metadata),
                )
                logger.info(f"Saved document {document_id} to database")
                return document_id
        except Exception as e:
            logger.error(f"Failed to save document: {e}")
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

    async def log_access_denial(
        self,
        organization_id: str,
        user_id: str,
        search_query: str,
        chunk_id: str,
        document_id: str,
        group_id: Optional[str],
        access_level: str,
        denial_reason: str,
        similarity_score: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        if not self.pool:
            await self.connect()

        query = """
            INSERT INTO "AccessDenialLog" (
                "organizationId",
                "userId",
                "searchQuery",
                "chunkId",
                "documentId",
                "groupId",
                "accessLevel",
                "denialReason",
                "similarity",
                "metadata",
                "timestamp"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        """

        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    query,
                    organization_id,
                    user_id,
                    search_query,
                    chunk_id,
                    document_id,
                    group_id,
                    access_level,
                    denial_reason,
                    similarity_score,
                    json.dumps(metadata) if metadata else None
                )
                logger.debug(
                    f"Logged access denial for user {user_id} to chunk {chunk_id} "
                    f"(reason: {denial_reason})"
                )
        except Exception as e:
            logger.error(f"Failed to log access denial: {e}")

    async def cleanup(self) -> None:
        """
        Cleanup method to close database connection pool.
        """
        logger.info("Cleaning up DatabaseService")
        try:
            if self.pool:
                await self.pool.close()
                self.pool = None
                logger.debug("Closed database connection pool")
        except Exception as e:
            logger.warning(f"Error during DatabaseService cleanup: {e}")

database_service = DatabaseService()
