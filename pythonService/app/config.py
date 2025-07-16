from pydantic_settings import BaseSettings
from pydantic import Field, validator
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from .env"""

    # SERVER CONFIGURATION
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8001, description="Server port")
    DEBUG: bool = Field(default=False, description="Debug mode")

    # CORS CONFIGURATION
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000",
        description="Allowed CORS origins"
    )

    # DATABASE CONFIGURATION (Required from environment)
    DATABASE_URL: str = Field(
        ...,
        description="Postgres DB connection URL"
    )

    # LOGGING CONFIGURATION
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    @property
    def ALLOWED_ORIGINS_LIST(self) -> List[str]:
        """Get CORS origins as a list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

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
            raise ValueError("DATABASE_URL must be a valid PostgreSQL connection string")
        return value

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        # Allow extra fields
        extra = "ignore"


# Create global settings instance
settings = Settings()


def get_settings() -> Settings:
    """
    Get application settings instance

    This function can be used as a FastAPI dependency:

    @app.get("/config")
    def get_config(settings: Settings = Depends(get_settings)):
        return {"debug": settings.DEBUG}
    """
    return settings


def reload_settings() -> Settings:
    """
    Reload settings from environment (useful for testing)
    """
    global settings
    settings = Settings()
    return settings
