from fastapi import APIRouter
from app.routes import inference, training

router = APIRouter()

router.include_router(inference.router, prefix="/inference", tags=["inference"])
router.include_router(training.router, prefix="/training", tags=["training"])

