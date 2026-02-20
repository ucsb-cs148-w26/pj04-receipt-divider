from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # TODO: change to False when migrating from Vercel
    serverless: bool = True

    database_user: str
    database_password: str
    database_host: str
    database_port: int
    database_name: str

    supabase_url: str
    supabase_jwt_secret: str

    @computed_field
    @property
    def database_url(self) -> str:
        return f"postgresql+psycopg2://{self.database_user}:{self.database_password}@{self.database_host}:{self.database_port}/{self.database_name}?sslmode=require"

    # Connection pool
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle: int = 600
    db_pool_timeout: int = 30


settings = Settings()
