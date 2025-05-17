import os
from typing import List, Optional

from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    # API settings
    PROJECT_NAME: str = "Cloud Management Platform"
    API_V1_STR: str = "/api"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    
    # JWT settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_jwt_secret_key_change_in_production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))  # 1 day
    
    # Database settings
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "cmpuser")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "cmppassword")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "cmpdb")
    
    # Azure OpenAI settings
    AZURE_OPENAI_API_KEY: Optional[str] = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT: Optional[str] = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_DEPLOYMENT_NAME: Optional[str] = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2023-05-15")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

