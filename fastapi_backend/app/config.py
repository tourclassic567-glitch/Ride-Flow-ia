from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql://rideflow:rideflow@db:5432/rideflow"
    stripe_secret_key: str = "sk_test_placeholder"
    port: int = 8000
    node_env: str = "production"
    allowed_origins: str = "*"

    @property
    def cors_origins(self) -> List[str]:
        if self.allowed_origins == "*":
            return ["*"]
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
