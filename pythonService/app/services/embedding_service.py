import logging
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmbeddingService:

    def __init__(self):
        # TODO: change embedding model, probably Qwen3
        self.model_name = getattr(settings, 'EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
        self._model = None
        self.embedding_dim = None  # Will be set when model is loaded

    @property
        if self._model is None:
            logger.info(f"Loading embedding model: {self.model_name}")
            try:
                self._model = SentenceTransformer(self.model_name)
                self.embedding_dim = self._model.get_sentence_embedding_dimension()
                logger.info(f"Embedding model loaded successfully. Dimension: {self.embedding_dim}")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                logger.info("Falling back to all-MiniLM-L6-v2")
                self._model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
                self.embedding_dim = self._model.get_sentence_embedding_dimension()
        return self._model

    def generate_embedding(self, text: str, normalize: bool = True) -> np.ndarray:
        """
        Args:
            text: Input text to embed
            normalize: Whether to normalize the embedding for cosine similarity

        Returns:
            Embedding vector as numpy array
        """
        if not text or not text.strip():
            logger.warning("Empty text provided for embedding")

            if self.embedding_dim is None:
                _ = self.model
            return np.zeros(self.embedding_dim, dtype=np.float32)

        try:
            embedding = self.model.encode(text, convert_to_numpy=True)

            if normalize:
                # Normalize for cosine similarity optimization
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                else:
                    logger.warning("Zero norm embedding generated")

            return embedding.astype(np.float32)

        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            # Return zero vector on error
            if self.embedding_dim is None:
                _ = self.model  # Force model loading to get dimension
            return np.zeros(self.embedding_dim, dtype=np.float32)

    def generate_embeddings_batch(
        self,
        texts: List[str],
        normalize: bool = True,
        batch_size: int = 32,
        show_progress: bool = True
    ) -> List[np.ndarray]:
        """
        Args:
            texts: List of texts to embed
            normalize: Whether to normalize embeddings
            batch_size: Batch size for processing
            show_progress: Whether to show progress bar

        Returns:
            List of embedding vectors
        """
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
                _ = self.model  # Force model loading to get dimension
            return [np.zeros(self.embedding_dim, dtype=np.float32) for _ in texts]

        try:
            # Generate embeddings
            embeddings = self.model.encode(
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
                _ = self.model
            return [np.zeros(self.embedding_dim, dtype=np.float32) for _ in texts]

embedding_service = EmbeddingService()
