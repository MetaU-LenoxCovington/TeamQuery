import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio

from app.services.document_conversion_service import DocumentConversionService
from app.services.text_cleaning_service import get_text_cleaning_service
from app.services.chunking_service import chunking_service
from app.services.metadata_extraction_service import metadata_extraction_service
from app.services.context_generation_service import context_generation_service
from app.services.embedding_service import embedding_service
from app.services.database_service import database_service
from app.services.search_index_builder_service import search_index_builder
from app.utils.token_utils import token_utils

logger = logging.getLogger(__name__)


class DocumentProcessingPipelineService:

    def __init__(self):
        self.document_converter = DocumentConversionService()
        self.text_cleaner = None

    async def process_document(
        self,
        file_path: str,
        document_id: str,
        organization_id: str,
        document_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a document through the complete pipeline.

        Args:
            file_path: Path to the uploaded file
            document_id: ID for the document
            organization_id: Organization this document belongs to
            document_metadata: Metadata about the document (title, access_level, etc.)

        Returns:
            Processing results including status and statistics
        """
        start_time = datetime.utcnow()
        stats = {
            "chunks_created": 0,
            "embeddings_created": 0,
            "errors": []
        }

        try:
            logger.info(f"Starting document processing for {document_id}")

            logger.info("Step 1: Converting document to markdown")
            markdown_content = await self._convert_document(file_path)
            if not markdown_content:
                raise ValueError("Document conversion failed - no content extracted")

            logger.info("Step 2: Cleaning text")
            cleaned_text = await self._clean_text(markdown_content)

            logger.info("Step 3: Creating semantic chunks")
            chunks = await self._create_chunks(cleaned_text, document_metadata.get("title", ""))
            logger.info(f"Created {len(chunks)} chunks")

            logger.info("Step 4: Processing chunks with batch operations")
            processed_chunks = await self._process_chunks_batch(
                chunks, document_metadata, document_id, organization_id
            )

            stats["chunks_created"] = len(processed_chunks)
            stats["embeddings_created"] = len(processed_chunks)

            logger.info(f"Successfully processed {len(processed_chunks)} chunks using batch operations")

            if processed_chunks:
                logger.info("Step 5: Updating search indexes")
                await search_index_builder.add_chunks(organization_id, processed_chunks)
                logger.info(f"Added {len(processed_chunks)} chunks to search index")

            processing_time = (datetime.utcnow() - start_time).total_seconds()

            return {
                "status": "completed" if not stats["errors"] else "completed_with_errors",
                "document_id": document_id,
                "processing_time": processing_time,
                "stats": stats
            }

        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            return {
                "status": "failed",
                "document_id": document_id,
                "error": str(e),
                "stats": stats
            }
        finally:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Cleaned up temporary file: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to clean up file {file_path}: {e}")

    async def _convert_document(self, file_path: str) -> str:
        from pathlib import Path
        return self.document_converter.process_document(Path(file_path))

    async def _clean_text(self, text: str) -> str:
        if self.text_cleaner is None:
            self.text_cleaner = get_text_cleaning_service()
        return self.text_cleaner.clean_document_with_placeholders(text)

    async def _create_chunks(self, text: str, document_title: str) -> List[Dict[str, Any]]:
        chunks_text = await chunking_service.chunk_document(text)
        return [{"content": chunk} for chunk in chunks_text]

    async def _generate_context(
        self, chunk_content: str, all_chunks: List[Dict[str, Any]], chunk_index: int
    ) -> str:
        full_document = "\n\n".join([chunk["content"] for chunk in all_chunks])
        return await context_generation_service.generate_context_for_chunk(
            chunk_content, full_document
        )

    async def _extract_metadata(
        self, chunk_content: str, document_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        return await metadata_extraction_service.extract_metadata(
            chunk_content, document_metadata
        )

    async def _generate_embedding(self, text: str) -> Optional[Any]:
        return await embedding_service.generate_embedding(text)

    async def _process_chunks_batch(
        self,
        chunks: List[Dict[str, Any]],
        document_metadata: Dict[str, Any],
        document_id: str,
        organization_id: str
    ) -> List[Dict[str, Any]]:
        try:
            logger.info("Generating contexts for all chunks...")
            contexts = []
            for i, chunk in enumerate(chunks):
                context = await self._generate_context(chunk["content"], chunks, i)
                contexts.append(context)

            logger.info("Extracting metadata for all chunks...")
            metadatas = []
            for chunk in chunks:
                metadata = await self._extract_metadata(chunk["content"], document_metadata)
                metadatas.append(metadata)

            logger.info("Generating embeddings in batch...")
            embedding_texts = []
            for i, (chunk, context) in enumerate(zip(chunks, contexts)):
                embedding_text = f"{chunk['content']}\n\nContext: {context}"

                is_valid, token_count = token_utils.validate_embedding_text_length(embedding_text)
                if not is_valid:
                    logger.warning(f"Chunk {i} embedding text has {token_count} tokens, truncating context")
                    max_context_tokens = 200  # limit for context
                    truncated_context = token_utils.truncate_to_token_limit(context, max_context_tokens)
                    embedding_text = f"{chunk['content']}\n\nContext: {truncated_context}"

                    is_valid_final, final_token_count = token_utils.validate_embedding_text_length(embedding_text)
                    if not is_valid_final:
                        logger.error(f"Chunk {i} still exceeds token limit after truncation ({final_token_count} tokens), using chunk only")
                        embedding_text = chunk['content']

                embedding_texts.append(embedding_text)

            embedding_vectors = await embedding_service.generate_embeddings_batch(embedding_texts)

            logger.info("Saving chunks and embeddings to database...")
            processed_chunks = []

            for i, (chunk, context, metadata, embedding_vector) in enumerate(
                zip(chunks, contexts, metadatas, embedding_vectors)
            ):
                if embedding_vector is None:
                    logger.error(f"Failed to generate embedding for chunk {i}")
                    continue

                chunk_data = {
                    "content": chunk["content"],
                    "metadata": {
                        **metadata,  # extracted metadata from LLM
                        "chunk_index": i,
                        "context": context,
                        "accessLevel": document_metadata.get("accessLevel", "GROUP"),
                        "groupId": document_metadata.get("groupId"),
                        "restrictedToUsers": document_metadata.get("restrictedToUsers", [])
                    }
                }

                chunk_id = await database_service.save_chunk(
                    chunk_data, document_id, organization_id
                )

                embedding_id = await database_service.save_embedding(
                    embedding_vector, chunk_id, document_id, organization_id
                )

                processed_chunks.append({
                    "chunk_id": chunk_id,
                    "document_id": document_id,
                    "embedding": embedding_vector,
                    "metadata": chunk_data["metadata"]
                })

            return processed_chunks

        except Exception as e:
            logger.error(f"Error in batch chunk processing: {e}")
            raise e

    async def _process_single_chunk(
        self,
        chunk: Dict[str, Any],
        chunk_index: int,
        all_chunks: List[Dict[str, Any]],
        document_metadata: Dict[str, Any],
        document_id: str,
        organization_id: str
    ) -> Optional[Dict[str, Any]]:
        try:
            context_task = asyncio.create_task(
                self._generate_context(chunk["content"], all_chunks, chunk_index)
            )
            metadata_task = asyncio.create_task(
                self._extract_metadata(chunk["content"], document_metadata)
            )

            context, metadata = await asyncio.gather(context_task, metadata_task)

            embedding_text = f"{chunk['content']}\n\nContext: {context}"

            embedding_vector = await self._generate_embedding(embedding_text)
            if embedding_vector is None:
                logger.error(f"Failed to generate embedding for chunk {chunk_index}")
                return None

            chunk_data = {
                "content": chunk["content"],
                "metadata": {
                    **metadata,  # metadata from LLM
                    "chunk_index": chunk_index,
                    "context": context,
                    "accessLevel": document_metadata.get("accessLevel", "GROUP"),
                    "groupId": document_metadata.get("groupId"),
                    "restrictedToUsers": document_metadata.get("restrictedToUsers", [])
                }
            }

            chunk_id = await database_service.save_chunk(
                chunk_data, document_id, organization_id
            )

            embedding_id = await database_service.save_embedding(
                embedding_vector, chunk_id, document_id, organization_id
            )

            return {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "embedding": embedding_vector,
                "metadata": chunk_data["metadata"]
            }

        except Exception as e:
            logger.error(f"Error processing chunk {chunk_index}: {e}")
            raise e

    def cleanup(self) -> None:

        logger.info("Cleaning up DocumentProcessingPipeline")
        try:
            self.text_cleaner = None
            logger.debug("DocumentProcessingPipeline cleanup completed")
        except Exception as e:
            logger.warning(f"Error during DocumentProcessingPipeline cleanup: {e}")


document_processing_pipeline = DocumentProcessingPipelineService()
