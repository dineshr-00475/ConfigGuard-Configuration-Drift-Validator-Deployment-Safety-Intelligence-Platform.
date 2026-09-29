import os


class Settings:
    PROJECT_NAME: str = "ConfigGuard"
    VERSION: str = "2.0.0"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./drift_validator.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "configguard-enterprise-secret-key-2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    SESSION_DURATION_MINUTES: int = 120


settings = Settings()
