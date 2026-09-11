from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "IR Block Planning"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,https://frontend-three-zeta-5njluc8cah.vercel.app",
        validation_alias="CORS_ORIGINS",
    )

    database_url: str = Field(
        default="postgresql+psycopg2://ir_block:ir_block@localhost:5432/block_planning",
        validation_alias="DATABASE_URL",
    )
    db_echo: bool = False

    optimizer_time_limit_seconds: int = 30
    ml_model_path: str = "app/ml/priority_model.joblib"
    export_dir: str = "exports"


settings = Settings()
