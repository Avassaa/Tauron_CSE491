from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Tauron AI Engine"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:4200", "http://localhost:8000"]
    
    MODEL_PATH: str = "./models"
    DATA_PATH: str = "./data"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

