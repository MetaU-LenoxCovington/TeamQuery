import logging
from contextlib import asynccontextmanager

import uvicorn
from app.config import get_settings
from app.routers import documents, search
from app.services.database_service import database_service
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

settings = get_settings()

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Python Service...")

    # Initialize database connection
    await database_service.connect()
    logger.info("Database connection established")

    yield

    logger.info("Shutting down Python Service...")
    # Cleanup resources
    await database_service.disconnect()
    logger.info("Database connection closed")


app = FastAPI(
    title="TeamQuery Document Processing Service",
    description="Document processing and RAG pipeline for TeamQuery",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
# app.include_router(embedding_recommendations.router, prefix="/api/recommendations", tags=["recommendations"])
# app.include_router(heuristic_recommendations.router, tags=["heuristic-recommendations"])

@app.get("/")
async def root():
    return {"message": "TeamQuery Python Service", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TeamQuery Python Service",
        "version": "1.0.0",
    }


@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint"""
    try:

        db_status = "error"
        if database_service.pool:
            try:
                async with database_service.pool.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                db_status = "ok"
            except Exception as e:
                logger.error(f"Database check failed: {e}")
                db_status = f"error: {str(e)}"

        return {
            "status": "ready" if db_status == "ok" else "not_ready",
            "checks": {
                "database": db_status,
                "environment": {
                    "DATABASE_URL": (
                        "configured" if settings.DATABASE_URL else "missing"
                    ),
                    "LLM_MODEL": settings.LLM_MODEL,
                },
            },
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail="Service not ready")


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
