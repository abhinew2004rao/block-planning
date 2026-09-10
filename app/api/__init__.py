from fastapi import APIRouter

from app.api.assets import router as assets_router
from app.api.blocks import router as blocks_router
from app.api.defects import router as defects_router
from app.api.optimization import router as optimization_router
from app.api.tasks import router as tasks_router

api_router = APIRouter(prefix="/api/v1")
api_alias_router = APIRouter(prefix="/api")

for r in [assets_router, defects_router, tasks_router, blocks_router, optimization_router]:
    api_router.include_router(r)
    api_alias_router.include_router(r)
