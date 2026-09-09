from datetime import date, time
from decimal import Decimal

from pydantic import ConfigDict, Field, model_validator

from app.schemas.common import KmChainage, PositiveMinutes, SchemaModel, TimestampRead, require_km_range
from app.schemas.enums import BlockTypeAllowed, FreightTrafficLevel


class CorridorWindowBase(SchemaModel):
    corridor_id: str = Field(min_length=1, max_length=40)
    section_code: str = Field(min_length=1, max_length=32)
    km_start: KmChainage
    km_end: KmChainage
    valid_date: date
    start_time: time
    end_time: time
    block_type_allowed: BlockTypeAllowed
    max_duration_min: PositiveMinutes
    train_impact_score: Decimal = Field(ge=0, le=100, max_digits=6, decimal_places=2)
    freight_traffic_level: FreightTrafficLevel
    source: str = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def validate_km_range(self) -> "CorridorWindowBase":
        require_km_range(self.km_start, self.km_end)
        return self


class CorridorWindowCreate(CorridorWindowBase):
    pass


class CorridorWindowRead(CorridorWindowBase, TimestampRead):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    window_id: int = Field(gt=0)
