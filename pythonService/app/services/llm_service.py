import logging
from typing import Optional

from app.config import settings
from ollama import chat

logger = logging.getLogger(__name__)


class LLMService:

    def __init__(self):
        self.model = settings.LLM_MODEL
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS

    async def call_model(self, prompt: str, **kwargs) -> str:
        """
        Call the LLM model with the given prompt

        Args:
            prompt: The input prompt
            **kwargs: Additional parameters to override defaults

        Returns:
            The model's response text
        """
        try:
            response = chat(
                model=kwargs.get("model", self.model),
                messages=[{"role": "user", "content": prompt}],
                keep_alive="1h",
                options={
                    "num_ctx": kwargs.get("max_tokens", self.max_tokens),
                    "temperature": kwargs.get("temperature", self.temperature),
                    "min_p": kwargs.get("min_p", 0.0),
                    "repeat_penalty": kwargs.get("repeat_penalty", 1.0),
                    "top_k": kwargs.get("top_k", 64),
                    "top_p": kwargs.get("top_p", 0.95),
                },
            )
            return response.message.content

        except Exception as e:
            logger.error(f"Error calling LLM model: {e}")
            raise


# Singleton instance
llm_service = LLMService()
