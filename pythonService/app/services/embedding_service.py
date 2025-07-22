import logging
from typing import List, Optional
import numpy as np
import asyncio
from openai import AsyncOpenAI
from sentence_transformers import SentenceTransformer
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmbeddingService:

    def __init__(self):
        self.local_model_name = getattr(settings, 'EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
        self._local_model = None
        self.local_embedding_dim = None

        self.openai_client = None
        if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
            self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        self.provider = getattr(settings, 'EMBEDDING_PROVIDER', 'openai')
        self.openai_model = getattr(settings, 'OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')
        self.batch_size = getattr(settings, 'EMBEDDING_BATCH_SIZE', 100)
        self.max_retries = getattr(settings, 'EMBEDDING_MAX_RETRIES', 3)

        if self.provider == 'openai':
            self.embedding_dim = 1536 if 'small' in self.openai_model else 3072
        else:
            self.embedding_dim = None

    @property
    def local_model(self):
        if self._local_model is None and self.provider == 'local':
            logger.info(f"Loading local embedding model: {self.local_model_name}")
            try:
                self._local_model = SentenceTransformer(self.local_model_name)
                self.local_embedding_dim = self._local_model.get_sentence_embedding_dimension()
                self.embedding_dim = self.local_embedding_dim
                logger.info(f"Local embedding model loaded successfully. Dimension: {self.embedding_dim}")
            except Exception as e:
                logger.error(f"Failed to load local embedding model: {e}")
                logger.info("Falling back to all-MiniLM-L6-v2")
                self._local_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
                self.local_embedding_dim = self._local_model.get_sentence_embedding_dimension()
                self.embedding_dim = self.local_embedding_dim
        return self._local_model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((Exception,))
    )
    async def _generate_embedding_openai(self, text: str) -> np.ndarray:
        try:
            response = await self.openai_client.embeddings.create(
                model=self.openai_model,
                input=text,
                encoding_format="float"
            )
            embedding = np.array(response.data[0].embedding, dtype=np.float32)

            # Normalize for cosine similarity
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

            return embedding

        except Exception as e:
            logger.error(f"OpenAI embedding generation failed: {e}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((Exception,))
    )
    async def _generate_embeddings_batch_openai(self, texts: List[str]) -> List[np.ndarray]:
        try:
            valid_indices = []
            valid_texts = []
            for i, text in enumerate(texts):
                if text and text.strip():
                    valid_indices.append(i)
                    valid_texts.append(text)

            if not valid_texts:
                logger.warning("No valid texts provided for batch embedding")
                return [np.zeros(self.embedding_dim, dtype=np.float32) for _ in texts]

            response = await self.openai_client.embeddings.create(
                model=self.openai_model,
                input=valid_texts,
                encoding_format="float"
            )

            embeddings = []
            for embedding_data in response.data:
                embedding = np.array(embedding_data.embedding, dtype=np.float32)

                # Normalize for cosine similarity
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm

                embeddings.append(embedding)

            result = []
            valid_idx = 0
            for i in range(len(texts)):
                if i in valid_indices:
                    result.append(embeddings[valid_idx])
                    valid_idx += 1
                else:
                    result.append(np.zeros(self.embedding_dim, dtype=np.float32))

            return result

        except Exception as e:
            logger.error(f"OpenAI batch embedding generation failed: {e}")
            raise

    def _generate_embedding_local(self, text: str, normalize: bool = True) -> np.ndarray:
        if not text or not text.strip():
            logger.warning("Empty text provided for embedding")
            if self.embedding_dim is None:
                _ = self.local_model
            return np.zeros(self.embedding_dim, dtype=np.float32)

        try:
            embedding = self.local_model.encode(text, convert_to_numpy=True)

            if normalize:
                # Normalize for cosine similarity optimization
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                else:
                    logger.warning("Zero norm embedding generated")

            return embedding.astype(np.float32)

        except Exception as e:
            logger.error(f"Error generating local embedding: {e}")
            # Return zero vector on error
            if self.embedding_dim is None:
                _ = self.local_model  # Force model loading to get dimension
            return np.zeros(self.embedding_dim, dtype=np.float32)

    def _generate_embeddings_batch_local(
        self,
        texts: List[str],
        normalize: bool = True,
        batch_size: int = 32,
        show_progress: bool = True
    ) -> List[np.ndarray]:
        if not texts:
            return []

        # Filter out empty texts but keep track of indices
        valid_indices = []
        valid_texts = []
        for i, text in enumerate(texts):
            if text and text.strip():
                valid_indices.append(i)
                valid_texts.append(text)

        if not valid_texts:
            logger.warning("No valid texts provided for batch embedding")
            # Return zero vectors for all inputs
            if self.embedding_dim is None:
                _ = self.local_model  # Force model loading to get dimension
            return [np.zeros(self.embedding_dim, dtype=np.float32) for _ in texts]

        try:
            # Generate embeddings
            embeddings = self.local_model.encode(
                valid_texts,
                convert_to_numpy=True,
                batch_size=batch_size,
                show_progress_bar=show_progress
            )

            if normalize:
                # Normalize each embedding
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                # Avoid division by zero
                norms = np.where(norms > 0, norms, 1)
                embeddings = embeddings / norms

            # Create result list with zero vectors for empty texts
            if self.embedding_dim is None:
                self.embedding_dim = embeddings.shape[1]

            result = []
            valid_idx = 0
            for i in range(len(texts)):
                if i in valid_indices:
                    result.append(embeddings[valid_idx].astype(np.float32))
                    valid_idx += 1
                else:
                    result.append(np.zeros(self.embedding_dim, dtype=np.float32))

            return result

        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            # Return zero vectors on error
            if self.embedding_dim is None:
                _ = self.local_model
            return [np.zeros(self.embedding_dim, dtype=np.float32) for _ in texts]

    async def generate_embedding(self, text: str, normalize: bool = True) -> np.ndarray:
        if self.provider == 'openai' and self.openai_client:
            return await self._generate_embedding_openai(text)
        else:
            return self._generate_embedding_local(text, normalize)

    async def generate_embeddings_batch(
        self,
        texts: List[str],
        normalize: bool = True,
        batch_size: Optional[int] = None,
        show_progress: bool = True
    ) -> List[np.ndarray]:

        if not texts:
            return []

        effective_batch_size = batch_size or self.batch_size

        if self.provider == 'openai' and self.openai_client:
            all_embeddings = []
            for i in range(0, len(texts), effective_batch_size):
                batch = texts[i:i + effective_batch_size]
                batch_embeddings = await self._generate_embeddings_batch_openai(batch)
                all_embeddings.extend(batch_embeddings)

                if i + effective_batch_size < len(texts):
                    await asyncio.sleep(0.1)

            return all_embeddings
        else:
            return self._generate_embeddings_batch_local(
                texts, normalize, effective_batch_size, show_progress
            )


    async def cleanup(self) -> None:
        logger.info("Cleaning up EmbeddingService")
        try:
            if self.openai_client:
                await self.openai_client.close()
                self.openai_client = None
                logger.debug("Closed OpenAI AsyncClient")

            self._local_model = None
            logger.debug("Cleared local embedding model reference")

        except Exception as e:
            logger.warning(f"Error during EmbeddingService cleanup: {e}")

embedding_service = EmbeddingService()
