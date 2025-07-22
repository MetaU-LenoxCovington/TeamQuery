import logging
from typing import Optional
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings
from ollama import chat

logger = logging.getLogger(__name__)
settings = get_settings()


class LLMService:

    def __init__(self):
        self.ollama_model = settings.LLM_MODEL
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS

        self.provider = getattr(settings, 'LLM_PROVIDER', 'gemini')

        self.gemini_model = getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash')
        self.gemini_temperature = getattr(settings, 'GEMINI_TEMPERATURE', 0.0)
        self.gemini_max_tokens = getattr(settings, 'GEMINI_MAX_TOKENS', 8192)
        self.gemini_max_retries = getattr(settings, 'GEMINI_MAX_RETRIES', 3)

        self.gemini_client = None
        if hasattr(settings, 'GOOGLE_API_KEY') and settings.GOOGLE_API_KEY:
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            self.gemini_client = genai.GenerativeModel(self.gemini_model)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=8, max=60),
        retry=retry_if_exception_type((Exception,))
    )
    async def _call_gemini_model(self, prompt: str, **kwargs) -> str:
        try:
            generation_config = genai.types.GenerationConfig(
                temperature=kwargs.get("temperature", self.gemini_temperature),
                max_output_tokens=kwargs.get("max_tokens", self.gemini_max_tokens),
                top_p=kwargs.get("top_p", 0.95),
                top_k=kwargs.get("top_k", 64),
            )

            response = await self.gemini_client.generate_content_async(
                prompt,
                generation_config=generation_config
            )

            if response.text:
                return response.text
            else:
                logger.error("Gemini returned empty response")
                raise ValueError("Empty response from Gemini")

        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                logger.warning(f"Gemini rate limit hit: {e}")
            else:
                logger.error(f"Error calling Gemini model: {e}")
            raise

    async def _call_ollama_model(self, prompt: str, **kwargs) -> str:
        try:
            response = chat(
                model=kwargs.get("model", self.ollama_model),
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
            logger.error(f"Error calling Ollama model: {e}")
            raise

    async def call_model(self, prompt: str, **kwargs) -> str:
        try:
            if self.provider == 'gemini' and self.gemini_client:
                return await self._call_gemini_model(prompt, **kwargs)
            else:
                return await self._call_ollama_model(prompt, **kwargs)

        except Exception as e:
            logger.error(f"Error calling LLM model with provider {self.provider}: {e}")
            raise


    async def cleanup(self) -> None:
        logger.info("Cleaning up LLMService")
        try:
            self.gemini_client = None
            logger.debug("Cleared Gemini client reference")

        except Exception as e:
            logger.warning(f"Error during LLMService cleanup: {e}")

llm_service = LLMService()
