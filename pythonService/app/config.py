import os
from functools import lru_cache
from typing import List, Optional

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

    # LLM Configuration
    LLM_MODEL: str = "llama3:8b"
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: int = 16384

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
