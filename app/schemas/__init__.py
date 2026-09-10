from app.schemas.asset import AssetBase, AssetCreate, AssetRead
from app.schemas.block import BlockBase, BlockCreate, BlockRead, BlockStatusUpdate
from app.schemas.block_task import BlockTaskBase, BlockTaskCreate, BlockTaskRead
from app.schemas.corridor_window import CorridorWindowBase, CorridorWindowCreate, CorridorWindowRead
from app.schemas.defect import DefectBase, DefectCreate, DefectRead, DefectStatusUpdate
from app.schemas.maintenance_task import (
    MaintenanceTaskBase,
    MaintenanceTaskCreate,
    MaintenanceTaskRead,
    TaskStatusUpdate,
)

__all__ = [
    "AssetBase",
    "AssetCreate",
    "AssetRead",
    "BlockBase",
    "BlockCreate",
    "BlockRead",
    "BlockStatusUpdate",
    "BlockTaskBase",
    "BlockTaskCreate",
    "BlockTaskRead",
    "CorridorWindowBase",
    "CorridorWindowCreate",
    "CorridorWindowRead",
    "DefectBase",
    "DefectCreate",
    "DefectRead",
    "DefectStatusUpdate",
    "MaintenanceTaskBase",
    "MaintenanceTaskCreate",
    "MaintenanceTaskRead",
    "TaskStatusUpdate",
]
