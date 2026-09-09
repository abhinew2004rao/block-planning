from datetime import date, time
from decimal import Decimal

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.schemas.common import (
    KmChainage,
    NonNegativeInt,
    PositiveMinutes,
    SchemaModel,
    TimestampRead,
    require_km_range,
)
from app.schemas.enums import BlockStatus, BlockType, Department


class BlockBase(SchemaModel):
    corridor_id: str = Field(min_length=1, max_length=40)
    section_code: str = Field(min_length=1, max_length=32)
    km_start: KmChainage
    km_end: KmChainage
    block_date: date
    start_time: time
    end_time: time
    duration_min: PositiveMinutes
    block_type: BlockType
    departments_involved: list[Department] = Field(min_length=1)
    status: BlockStatus = "planned"
    planned_tasks_count: NonNegativeInt = 0
    estimated_train_impact: Decimal = Field(default=Decimal("0"), ge=0, le=100, max_digits=6, decimal_places=2)
    created_by: str = Field(min_length=1, max_length=80)

    @field_validator("departments_involved")
    @classmethod
    def unique_departments(cls, value: list[Department]) -> list[Department]:
        if len(value) != len(set(value)):
            raise ValueError("departments_involved must not contain duplicates")
        return value

    @model_validator(mode="after")
    def validate_km_range(self) -> "BlockBase":
        require_km_range(self.km_start, self.km_end)
        return self


class BlockCreate(BlockBase):
    pass


class BlockRead(BlockBase, TimestampRead):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    block_id: int = Field(gt=0)
