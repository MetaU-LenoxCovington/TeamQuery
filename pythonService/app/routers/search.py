from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from fastapi import BackgroundTasks

from app.services.search_index_builder_service import search_index_builder
from app.services.search_service import search_service
from app.services.heuristic_recommendation_service import heuristic_recommendation_service

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
    force_rebuild: bool = False


class IndexStatus(BaseModel):
    organization_id: str
    status: str  # "building", "ready", "failed"
    document_count: int
    chunk_count: int
    last_updated: Optional[str] = None
    build_time: Optional[float] = None


class UserGroupRecommendationRequest(BaseModel):
    user_id: str
    organization_id: str
    top_k: int = 3


class GroupRecommendation(BaseModel):
    group_id: str
    group_name: str
    score: float
    reason: str
    details: Dict[str, Any]


class UserGroupRecommendationResponse(BaseModel):
    user_id: str
    organization_id: str
    recommendations: List[GroupRecommendation]
    processing_time: float


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
    import time
    from app.services.llm_service import llm_service

    start_time = time.time()

    try:
        logger.info(f"RAG query: {query.query} in org {query.organization_id}")

        enhanced_queries = await llm_service.enhance_query(
            query.query,
            conversation_history=[]  # TODO: Add conversation history support
        )
        logger.info(f"Enhanced queries: {enhanced_queries}")

        all_results = []

        for enhanced_query in enhanced_queries:
            search_result = await search_service.search(
                query=enhanced_query,
                organization_id=query.organization_id,
                filters=query.filters,
                k=10
            )

            if search_result.get("results"):
                all_results.extend(search_result["results"])

        unique_results = {}
        if all_results:
            seen_chunks = {}
            for result in all_results:
                chunk_id = result["chunk_id"]
                if chunk_id not in seen_chunks or result["score"] > seen_chunks[chunk_id]["score"]:
                    seen_chunks[chunk_id] = result

            unique_results = sorted(seen_chunks.values(), key=lambda x: x["score"], reverse=True)[:15]

        context_chunks = []
        for result in unique_results:
            context_chunks.append({
                "chunk_id": result["chunk_id"],
                "document_id": result["document_id"],
                "content": result["content"],
                "score": result["score"],
                "metadata": result["metadata"]
            })

        selected_context = await llm_service.select_context(
            query.query,
            context_chunks
        )

        selected_context = selected_context[:query.max_context_chunks]

        generation_result = await llm_service.generate_answer(
            query.query,
            selected_context,
            conversation_history=[]  # TODO: Add conversation history support
        )

        rag_sources = []
        for source_data in generation_result["sources"]:
            rag_sources.append(RAGSource(
                chunk_id=source_data["chunk_id"],
                document_id=source_data["document_id"],
                document_title=source_data["document_title"],
                content=source_data["content"],
                page_number=source_data.get("page_number"),
                relevance_score=source_data["relevance_score"]
            ))

        processing_time = time.time() - start_time

        logger.info(f"RAG query completed in {processing_time:.2f}s with {len(rag_sources)} sources")

        return RAGResponse(
            query=query.query,
            answer=generation_result["answer"],
            sources=rag_sources,
            conversation_id=query.conversation_id,
            processing_time=processing_time
        )

    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"RAG query failed after {processing_time:.2f}s: {e}")

        return RAGResponse(
            query=query.query,
            answer="I encountered an error while processing your question. Please try again or rephrase your query.",
            sources=[],
            conversation_id=query.conversation_id,
            processing_time=processing_time
        )


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


@router.post("/users/{user_id}/group-recommendations", response_model=UserGroupRecommendationResponse)
async def get_user_group_recommendations(user_id: str, request: UserGroupRecommendationRequest):
    """
    Get group recommendations for a specific user based on their collaboration patterns,
    access denials, and buddy networks.
    """
    import time

    start_time = time.time()

    try:
        logger.info(f"Getting group recommendations for user {user_id} in organization {request.organization_id}")

        if user_id != request.user_id:
            raise HTTPException(status_code=400, detail="User ID in path must match user ID in request body")

        recommendations = await heuristic_recommendation_service.get_group_recommendations_for_user(
            user_id=request.user_id,
            organization_id=request.organization_id,
            top_k=request.top_k
        )

        formatted_recommendations = []
        for rec in recommendations:
            formatted_recommendations.append(GroupRecommendation(
                group_id=rec["group_id"],
                group_name=rec["group_name"],
                score=rec["score"],
                reason=rec["reason"],
                details=rec["details"]
            ))

        processing_time = time.time() - start_time

        logger.info(f"Generated {len(formatted_recommendations)} group recommendations for user {user_id} in {processing_time:.2f}s")

        return UserGroupRecommendationResponse(
            user_id=request.user_id,
            organization_id=request.organization_id,
            recommendations=formatted_recommendations,
            processing_time=processing_time
        )

    except Exception as e:
        processing_time = time.time() - start_time
        logger.error(f"Failed to get group recommendations for user {user_id} after {processing_time:.2f}s: {e}")
        raise HTTPException(status_code=500, detail=str(e))
