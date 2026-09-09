from app.schemas.asset import AssetBase, AssetCreate, AssetRead
from app.schemas.block import BlockBase, BlockCreate, BlockRead
from app.schemas.block_task import BlockTaskBase, BlockTaskCreate, BlockTaskRead
from app.schemas.corridor_window import CorridorWindowBase, CorridorWindowCreate, CorridorWindowRead
from app.schemas.defect import DefectBase, DefectCreate, DefectRead
from app.schemas.maintenance_task import MaintenanceTaskBase, MaintenanceTaskCreate, MaintenanceTaskRead

__all__ = [
    "AssetBase",
    "AssetCreate",
    "AssetRead",
    "BlockBase",
    "BlockCreate",
    "BlockRead",
    "BlockTaskBase",
    "BlockTaskCreate",
    "BlockTaskRead",
    "CorridorWindowBase",
    "CorridorWindowCreate",
    "CorridorWindowRead",
    "DefectBase",
    "DefectCreate",
    "DefectRead",
    "MaintenanceTaskBase",
    "MaintenanceTaskCreate",
    "MaintenanceTaskRead",
]
