from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "SafeSpace API"
    ENVIRONMENT: str = "development"

    # Firebase Auth
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_PATH: str = ""

    # Databases
    POSTGRES_URL: str = "postgresql://safespace:safespace@localhost:5432/safespace"
    FIRESTORE_PROJECT_ID: str = ""

    # AI services
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "claude-sonnet-4-6"

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]

    # Caregiver dashboard default window — see docs/Architecture_Specification.md
    # section 8, item 4: this is a reasonable guess, not literature-derived.
    DASHBOARD_DEFAULT_WINDOW_DAYS: int = 7

    class Config:
        env_file = ".env"


settings = Settings()
