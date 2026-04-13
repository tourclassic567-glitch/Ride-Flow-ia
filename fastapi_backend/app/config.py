from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://rideflow:rideflow@db:5432/rideflow"
    stripe_secret_key: str = "sk_test_placeholder"
    port: int = 8000
    node_env: str = "production"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
