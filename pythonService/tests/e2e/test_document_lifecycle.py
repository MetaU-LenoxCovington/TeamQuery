import pytest
from httpx import AsyncClient
from typing import Dict, Any, List
from pathlib import Path
import os
import uuid
import time
import asyncio

from app.services.database_service import database_service
from app.services.search_index_builder_service import search_index_builder

pytestmark = pytest.mark.asyncio


async def wait_for_processing(document_id: str, timeout: int = 300):
    start_time = time.time()
    while time.time() - start_time < timeout:
        async with database_service.pool.acquire() as conn:
            count = await conn.fetchval(
                'SELECT COUNT(*) FROM "Chunk" WHERE "documentId" = $1', document_id
            )
            if count > 0:
                return True
        await asyncio.sleep(2)
    raise TimeoutError(f"Document {document_id} not processed within {timeout} seconds.")


@pytest.mark.e2e
async def test_document_upload_and_processing(
    test_client: AsyncClient,
    test_organization: Dict[str, Any],
    assets_path: Path,
    test_documents: List[Dict[str, Any]],
):
    org_id = test_organization["org_id"]
    doc_info = test_documents[0]
    doc_id = f"test-doc-{uuid.uuid4().hex}"

    file_path = assets_path / doc_info["file"]
    if not file_path.exists():
        with open(file_path, "w") as f:
            f.write("This is a test file for the e2e test.")

    with open(file_path, "rb") as f:
        response = await test_client.post(
            "/api/documents/upload",
            files={"file": (file_path.name, f, "text/plain")},
            data={
                "organization_id": org_id,
                "document_id": doc_id,
                "title": doc_info["title"],
                "access_level": doc_info["accessLevel"],
            },
        )
    assert response.status_code == 200
    assert response.json()["status"] == "queued"

    await wait_for_processing(doc_id)

    async with database_service.pool.acquire() as conn:
        chunks = await conn.fetch('SELECT * FROM "Chunk" WHERE "documentId" = $1', doc_id)
        embeddings = await conn.fetch('SELECT * FROM "Embedding" WHERE "documentId" = $1', doc_id)

        assert len(chunks) > 0
        assert len(chunks) == len(embeddings)

        # Check that metadata was correctly propagated
        first_chunk_metadata = chunks[0]['metadata']
        if isinstance(first_chunk_metadata, str):
            import json
            first_chunk_metadata = json.loads(first_chunk_metadata)
        assert first_chunk_metadata['accessLevel'] == doc_info['accessLevel']

    org_indexes = search_index_builder.get_indexes(org_id)
    assert org_indexes is not None
    assert org_indexes.hnsw_index is not None

    node_found = False
    for node in org_indexes.hnsw_index.nodes.values():
        if node.document_id == doc_id:
            node_found = True
            assert node.metadata['accessLevel'] == doc_info['accessLevel']
            break
    assert node_found, "Document's chunks not found in the HNSW index."


@pytest.mark.e2e
@pytest.mark.xfail(reason="API endpoint not implemented yet.", raises=NotImplementedError)
async def test_update_document_metadata(
    test_client: AsyncClient,
    test_organization: Dict[str, Any]
):

    raise NotImplementedError("Update document metadata endpoint is not implemented.")


@pytest.mark.e2e
@pytest.mark.xfail(reason="API endpoint not implemented yet.", raises=NotImplementedError)
async def test_delete_document(
    test_client: AsyncClient,
    test_organization: Dict[str, Any]
):
    document_id = "some-processed-document-id"
    org_id = test_organization["org_id"]

    response = await test_client.delete(f"/api/documents/{document_id}")
    assert response.status_code == 200

    raise NotImplementedError("Delete document endpoint is not implemented.")
