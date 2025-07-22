from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import os
import uuid
from datetime import datetime
import aiofiles

from app.services.document_processing_pipeline import document_processing_pipeline

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class DocumentProcessRequest(BaseModel):
    document_id: str
    organization_id: str
    s3_bucket: str
    s3_key: str
    original_filename: str
    file_size: int
    mime_type: str


class DocumentProcessResponse(BaseModel):
    document_id: str
    status: str
    message: str
    chunks_created: Optional[int] = None
    processing_time: Optional[float] = None


class ProcessingStatus(BaseModel):
    document_id: str
    status: str  # "processing", "completed", "failed"
    progress: float  # 0.0 to 1.0
    message: str
    chunks_created: Optional[int] = None
    error: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str
    message: str
    task_id: str


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    document_id: str = Form(...),
    title: str = Form(...),
    access_level: str = Form("GROUP"),
    group_id: Optional[str] = Form(None),
    restricted_to_users: Optional[str] = Form(None)  # JSON string array
):
    """
    Args:
        file: The document file to upload
        organization_id: Organization this document belongs to
        document_id: ID for the document
        title: Document title
        access_level: Access level (PUBLIC, GROUP, MANAGERS, ADMINS, RESTRICTED)
        group_id: Group ID if access_level is GROUP
        restricted_to_users: JSON array of user IDs if access_level is RESTRICTED
    """
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        restricted_users = []
        if restricted_to_users:
            try:
                import json
                restricted_users = json.loads(restricted_to_users)
            except:
                raise HTTPException(status_code=400, detail="Invalid restricted_to_users format")

        file_extension = os.path.splitext(file.filename)[1]
        temp_filename = f"{document_id}_{uuid.uuid4()}{file_extension}"
        temp_path = os.path.join(UPLOAD_DIR, temp_filename)

        async with aiofiles.open(temp_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        logger.info(f"Saved uploaded file to {temp_path}")

        document_metadata = {
            "title": title,
            "accessLevel": access_level,
            "groupId": group_id,
            "restrictedToUsers": restricted_users,
            "originalFilename": file.filename,
            "mimeType": file.content_type,
            "uploadedAt": datetime.utcnow().isoformat()
        }

        task_id = f"doc-process-{document_id}-{uuid.uuid4()}"

        from app.services.database_service import database_service
        try:
            await database_service.save_document(document_id, organization_id, document_metadata)
            logger.info(f"Successfully created Document record for {document_id}")
        except Exception as e:
            logger.error(f"Failed to create Document record for {document_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create document record: {str(e)}")

        background_tasks.add_task(
            process_document_with_pipeline,
            temp_path,
            document_id,
            organization_id,
            document_metadata,
            task_id
        )

        return DocumentUploadResponse(
            document_id=document_id,
            status="queued",
            message="Document uploaded and queued for processing",
            task_id=task_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload document: {e}")
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process", response_model=DocumentProcessResponse)
async def process_document(
    request: DocumentProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    Process a document: extract text, chunk, generate embeddings, and store
    """
    try:
        logger.info(f"Starting document processing for {request.document_id}")

        # Add document processing to background tasks
        background_tasks.add_task(
            process_document_task,
            request.document_id,
            request.organization_id,
            request.s3_bucket,
            request.s3_key,
            request.original_filename,
            request.mime_type
        )

        return DocumentProcessResponse(
            document_id=request.document_id,
            status="queued",
            message="Document processing has been queued"
        )

    except Exception as e:
        logger.error(f"Failed to queue document processing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{document_id}", response_model=ProcessingStatus)
async def get_processing_status(document_id: str):
    """
    Get the processing status of a document
    """
    try:
        # TODO: Implement actual status checking
        # This would check a database or cache for processing status

        return ProcessingStatus(
            document_id=document_id,
            status="completed",  # TODO: Get actual status
            progress=1.0,
            message="Document processing completed successfully",
            chunks_created=42  # TODO: Get actual chunk count
        )

    except Exception as e:
        logger.error(f"Failed to get processing status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reprocess/{document_id}")
async def reprocess_document(
    document_id: str,
    background_tasks: BackgroundTasks
):
    """
    Reprocess an existing document
    """
    try:
        logger.info(f"Reprocessing document {document_id}")

        # TODO: Get document info from database
        # TODO: Add reprocessing task to background tasks

        return {"message": f"Document {document_id} reprocessing queued"}

    except Exception as e:
        logger.error(f"Failed to reprocess document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_document_task(
    document_id: str,
    organization_id: str,
    s3_bucket: str,
    s3_key: str,
    original_filename: str,
    mime_type: str
):
    """
    Background task for document processing from S3
    """
    try:
        logger.info(f"Processing document {document_id} from S3 in background")

        # TODO: Implement S3 download and processing
        # This would download from S3 and then call the processing pipeline

        logger.warning("S3 processing not yet implemented")

    except Exception as e:
        logger.error(f"Document processing failed for {document_id}: {e}")


async def process_document_with_pipeline(
    file_path: str,
    document_id: str,
    organization_id: str,
    document_metadata: Dict[str, Any],
    task_id: str
):
    """
    Background task for document processing using the pipeline
    """
    try:
        logger.info(f"Processing document {document_id} with task {task_id}")

        result = await document_processing_pipeline.process_document(
            file_path=file_path,
            document_id=document_id,
            organization_id=organization_id,
            document_metadata=document_metadata
        )

        if result["status"] == "completed":
            logger.info(
                f"Document {document_id} processed successfully. "
                f"Created {result['stats']['chunks_created']} chunks in "
                f"{result['processing_time']:.2f} seconds"
            )
        elif result["status"] == "completed_with_errors":
            logger.warning(
                f"Document {document_id} processed with errors: {result['stats']['errors']}"
            )
        else:
            logger.error(f"Document {document_id} processing failed: {result.get('error')}")

        # TODO: Store processing result in database for status tracking

    except Exception as e:
        logger.error(f"Document processing failed for {document_id}: {e}")
        # TODO: Update status to failed in database
