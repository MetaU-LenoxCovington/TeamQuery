"""
For creating mock search data directly in the database without running the document processing pipeline.
"""

import asyncio
import json
import numpy as np
from typing import Dict, Any, List
from app.services.database_service import database_service
from app.services.search_index_builder_service import search_index_builder
from .search_test_data import prepare_mock_data_for_org, prepare_test_users


async def insert_mock_search_data(org_id: str, group_mapping: Dict[str, str]) -> Dict[str, Any]:
    """
    Args:
        org_id: Organization ID
        group_mapping: Mapping of placeholder group names to actual group IDs

    Returns:
        Dict containing information about the inserted data
    """
    mock_data = prepare_mock_data_for_org(org_id, group_mapping)

    async with database_service.pool.acquire() as conn:
        for doc in mock_data["documents"]:
            await conn.execute('''
                INSERT INTO "Document" (
                    id, "organizationId", title, "accessLevel", "groupId",
                    "restrictedToUsers", "isDeleted", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            ''',
                doc["id"], doc["organizationId"], doc["title"], doc["accessLevel"],
                doc["groupId"], doc["restrictedToUsers"], doc["isDeleted"]
            )

        for chunk in mock_data["chunks"]:
            await conn.execute('''
                INSERT INTO "Chunk" (
                    id, "documentId", "organizationId", content, metadata,
                    "isDeleted", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            ''',
                chunk["id"], chunk["documentId"], chunk["organizationId"],
                chunk["content"], json.dumps(chunk["metadata"]), chunk["isDeleted"]
            )

        for embedding in mock_data["embeddings"]:
            vector_bytes = np.array(embedding["vector"], dtype=np.float32).tobytes()

            await conn.execute('''
                INSERT INTO "Embedding" (
                    id, "chunkId", "documentId", "organizationId", vector,
                    "isDeleted", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            ''',
                embedding["id"], embedding["chunkId"], embedding["documentId"],
                embedding["organizationId"], vector_bytes, embedding["isDeleted"]
            )

    await search_index_builder.build_or_update_index(org_id, force_rebuild=True)

    return {
        "org_id": org_id,
        "documents": mock_data["documents"],
        "chunks": mock_data["chunks"],
        "embeddings": mock_data["embeddings"],
        "groups": group_mapping,
        "test_users": prepare_test_users(group_mapping)
    }


async def cleanup_mock_search_data(org_id: str):

    async with database_service.pool.acquire() as conn:
        await conn.execute('DELETE FROM "Embedding" WHERE "organizationId" = $1', org_id)
        await conn.execute('DELETE FROM "Chunk" WHERE "organizationId" = $1', org_id)
        await conn.execute('DELETE FROM "Document" WHERE "organizationId" = $1', org_id)

    if search_index_builder.has_indexes(org_id):
        search_index_builder.destroy_indexes(org_id, persist_to_disk=False)
