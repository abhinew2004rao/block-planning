from datetime import datetime

from pydantic import ConfigDict, Field

from app.schemas.common import ORMModel, PositiveMinutes, SchemaModel
from app.schemas.enums import Department


class BlockTaskBase(SchemaModel):
    block_id: int = Field(gt=0)
    task_id: int = Field(gt=0)
    department: Department
    planned_duration_min: PositiveMinutes
    sequence_order: int = Field(ge=1)


class BlockTaskCreate(BlockTaskBase):
    pass


class BlockTaskRead(BlockTaskBase, ORMModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    id: int = Field(gt=0)
    created_at: datetime
