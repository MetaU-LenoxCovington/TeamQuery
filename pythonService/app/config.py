import os
from typing import List
from functools import lru_cache
from pydantic import Field, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from .env"""

    # SERVER CONFIGURATION
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8001, description="Server port")
    DEBUG: bool = Field(default=False, description="Debug mode")

    # CORS CONFIGURATION
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000", description="Allowed CORS origins"
    )

    # DATABASE CONFIGURATION (Required from environment)
    DATABASE_URL: str = Field(..., description="Postgres DB connection URL")

    OPENAI_API_KEY: str = Field(..., description="OpenAI API key")
    GOOGLE_API_KEY: str = Field(..., description="Google API key for Gemini")

    EMBEDDING_PROVIDER: str = Field(default="openai", description="openai or local")
    OPENAI_EMBEDDING_MODEL: str = Field(default="text-embedding-3-small", description="OpenAI embedding model")
    EMBEDDING_BATCH_SIZE: int = Field(default=100, description="Batch size for embedding generation")
    EMBEDDING_MAX_RETRIES: int = Field(default=3, description="Max retries for embedding API calls")

    # LLM Configuration
    LLM_PROVIDER: str = Field(default="gemini", description="gemini or ollama")
    LLM_MODEL: str = "llama3:8b"  # For running LLM locally
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: int = 16384

    GEMINI_MODEL: str = Field(default="gemini-2.0-flash-exp", description="Gemini model name")
    GEMINI_TEMPERATURE: float = Field(default=0.0, description="Gemini temperature")
    GEMINI_MAX_TOKENS: int = Field(default=8192, description="Gemini max tokens")
    GEMINI_MAX_RETRIES: int = Field(default=3, description="Max retries for Gemini API calls")

    # LOGGING CONFIGURATION
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    @property
    def ALLOWED_ORIGINS_LIST(self) -> List[str]:
        """Get CORS origins as a list"""
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    # VALIDATORS
    @validator("LOG_LEVEL")
    def validate_log_level(cls, value):
        """Validate log level"""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if value.upper() not in valid_levels:
            raise ValueError(f"LOG_LEVEL must be one of: {valid_levels}")
        return value.upper()

    @validator("DATABASE_URL")
    def validate_database_url(cls, value):
        """Validate database URL format"""
        if not value.startswith(("postgresql://", "postgres://")):
            raise ValueError(
                "DATABASE_URL must be a valid PostgreSQL connection string"
            )
        return value

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        # Allow extra fields
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    """
    Reload settings from environment (useful for testing)
    """
    global settings
    settings = Settings()
    return settings
