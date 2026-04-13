"""Central configuration loaded from environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Ride-Flow IA Agents"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "production"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://rideflow:rideflow@postgres:5432/rideflow"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # Redis
    redis_url: str = "redis://redis:6379/0"
    redis_max_connections: int = 20

    # OpenAI (for LangChain agents)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Security
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    admin_api_key: str = "change-me-admin-key"

    # Agent intervals (seconds)
    pricing_agent_interval: int = 60
    matching_agent_interval: int = 10
    monitoring_agent_interval: int = 30
    revenue_agent_interval: int = 300
    analytics_agent_interval: int = 120
    security_agent_interval: int = 60

    # Prometheus
    metrics_port: int = 9090


@lru_cache
def get_settings() -> Settings:
    return Settings()
