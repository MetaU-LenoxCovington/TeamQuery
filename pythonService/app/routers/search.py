from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from fastapi import BackgroundTasks

from app.services.search_index_builder_service import search_index_builder
from app.services.search_service import search_service

logger = logging.getLogger(__name__)

router = APIRouter()


class SearchQuery(BaseModel):
    query: str
    organization_id: str
    filters: Optional[Dict[str, Any]] = None
    k: int = 10


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    content: str
    score: float
    metadata: Optional[Dict[str, Any]] = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int
    processing_time: float


class RAGQuery(BaseModel):
    query: str
    organization_id: str
    conversation_id: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    max_context_chunks: int = 5


class RAGSource(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    content: str
    page_number: Optional[int] = None
    relevance_score: float


class RAGResponse(BaseModel):
    query: str
    answer: str
    sources: List[RAGSource]
    conversation_id: Optional[str] = None
    processing_time: float


class IndexBuildRequest(BaseModel):
    organization_id: str


class IndexStatus(BaseModel):
    organization_id: str
    status: str  # "building", "ready", "failed"
    document_count: int
    chunk_count: int
    last_updated: Optional[str] = None
    build_time: Optional[float] = None


@router.post("/build-index", response_model=Dict[str, Any])
async def build_search_index(request: IndexBuildRequest):
    """
    Build search indexes for an organization
    """
    try:
        logger.info(f"Building search index for organization {request.organization_id}")

        org_indexes = await search_index_builder.build_or_update_index(
            request.organization_id,
            force_rebuild=request.force_rebuild
        )

        return {
            "message": f"Index built successfully for organization {request.organization_id}",
            "stats": {
                "chunk_count": org_indexes.chunk_count,
                "document_count": org_indexes.document_count,
                "last_updated": org_indexes.last_updated.isoformat() if org_indexes.last_updated else None,
                "has_hnsw": org_indexes.hnsw_index is not None
            }
        }

    except Exception as e:
        logger.error(f"Failed to build search index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=Dict[str, Any])
async def search_documents(query: SearchQuery):
    try:
        logger.info(f"Searching for: {query.query} in org {query.organization_id}")

        search_results = await search_service.search(
            query=query.query,
            organization_id=query.organization_id,
            filters=query.filters,
            k=query.k
        )

        formatted_results = []
        for result in search_results.get("results", []):
            formatted_results.append({
                "chunk_id": result["chunk_id"],
                "document_id": result["document_id"],
                "content": result["content"],
                "score": result["score"],
                "metadata": result["metadata"]
            })

        return {
            "query": search_results["query"],
            "results": formatted_results,
            "total_results": search_results["total_results"],
            "processing_time": search_results["processing_time"],
            "indexes_used": search_results.get("indexes_used", {}),
            "error": search_results.get("error")
        }

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag-query", response_model=RAGResponse)
async def rag_query(query: RAGQuery):
    """
    Execute a RAG query: search + context retrieval + LLM generation
    """
    try:
        logger.info(f"RAG query: {query.query} in org {query.organization_id}")

        # TODO: Implement actual RAG pipeline
        # 1. Search for relevant chunks
        # 2. Retrieve context
        # 3. Generate response with LLM
        # 4. Format citations

        # Mock response for now
        mock_sources = [
            RAGSource(
                chunk_id="chunk_1",
                document_id="doc_1",
                document_title="Sample Document",
                content="Relevant content from the document...",
                page_number=1,
                relevance_score=0.85
            )
        ]

        return RAGResponse(
            query=query.query,
            answer="Based on the documents, here is the answer to your question...",
            sources=mock_sources,
            conversation_id=query.conversation_id,
            processing_time=2.45
        )

    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rebuild-index", response_model=Dict[str, Any])
async def rebuild_search_index(request: IndexBuildRequest):
    try:
        logger.info(f"Force rebuilding search index for organization {request.organization_id}")

        org_indexes = await search_index_builder.build_or_update_index(
            request.organization_id,
            force_rebuild=True
        )

        return {
            "message": f"Index rebuilt successfully for organization {request.organization_id}",
            "stats": {
                "chunk_count": org_indexes.chunk_count,
                "document_count": org_indexes.document_count,
                "last_updated": org_indexes.last_updated.isoformat() if org_indexes.last_updated else None,
                "has_hnsw": org_indexes.hnsw_index is not None
            }
        }

    except Exception as e:
        logger.error(f"Failed to rebuild search index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/full-reprocess", response_model=Dict[str, str])
async def full_reprocess_organization(
    request: IndexBuildRequest,
    background_tasks: BackgroundTasks
):
    """
    TODO: Trigger a full reprocessing of all documents for an organization
    downloading from S3 and running the full pipeline.
    """
    logger.warning("Full re-process endpoint is a placeholder and not yet implemented.")

    background_tasks.add_task(
        search_index_builder.trigger_full_reprocess,
        request.organization_id
    )

    return {
        "message": f"Full re-processing task queued for organization {request.organization_id}. NOTE: This is not yet implemented."
    }


@router.get("/index-status/{organization_id}")
async def get_index_status(organization_id: str):
    try:
        org_indexes = search_index_builder.get_indexes(organization_id)

        if not org_indexes:
            return {
                "organization_id": organization_id,
                "has_indexes": False,
                "status": "not_found",
                "message": "No indexes found for this organization"
            }

        return {
            "organization_id": organization_id,
            "has_indexes": True,
            "status": "ready" if not org_indexes.is_building else "building",
            "chunk_count": org_indexes.chunk_count,
            "document_count": org_indexes.document_count,
            "last_updated": org_indexes.last_updated.isoformat() if org_indexes.last_updated else None,
            "total_nodes": org_indexes.hnsw_index.size if org_indexes.hnsw_index else 0,
            "indexes": {
                "hnsw": {
                    "status": "ready" if org_indexes.hnsw_index else "not_built",
                    "chunk_count": org_indexes.chunk_count if org_indexes.hnsw_index else 0
                },
                "bm25": {"status": "not_implemented"},
                "inverted": {"status": "not_implemented"}
            }
        }

    except Exception as e:
        logger.error(f"Failed to get index status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/index-stats")
async def get_all_index_stats():
    try:
        stats = search_index_builder.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get index stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/index/{organization_id}")
async def destroy_index(organization_id: str, persist: bool = False):
    """
    Destroy search indexes for an organization.
    Optionally persist the index to disk before destroying.
    """
    try:
        logger.info(f"Destroying index for organization {organization_id}")

        success = search_index_builder.destroy_indexes(organization_id, persist_to_disk=persist)

        if success:
            return {"message": f"Index destroyed for organization {organization_id}", "persisted": persist}
        else:
            return {"message": f"No indexes found for organization {organization_id}"}

    except Exception as e:
        logger.error(f"Failed to destroy index: {e}")
        raise HTTPException(status_code=500, detail=str(e))
