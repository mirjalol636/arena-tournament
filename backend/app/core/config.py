from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./arena.db"
    redis_url: str = ""
    jwt_secret: str
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"
    telegram_bot_token: str = ""
    bot_api_secret: str = ""
    public_url: str = "http://localhost:3000"
    cookie_secure: bool = False

    @model_validator(mode="after")
    def validate_config(self):
        if len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must contain at least 32 characters")
        if self.environment == "production":
            if (
                not self.cookie_secure
                or not self.redis_url
                or not self.database_url.startswith("postgresql")
            ):
                raise ValueError(
                    "Production requires PostgreSQL, Redis and COOKIE_SECURE=true"
                )
        return self


@lru_cache
def settings():
    return Settings()
