from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

KmChainage = Annotated[Decimal, Field(ge=0, max_digits=8, decimal_places=3)]
Score100 = Annotated[float, Field(ge=0, le=100)]
Probability = Annotated[float, Field(ge=0, le=1)]
PositiveMinutes = Annotated[int, Field(gt=0)]
NonNegativeInt = Annotated[int, Field(ge=0)]


class SchemaModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class ORMModel(SchemaModel):
    """Read models populated from SQLAlchemy instances."""


def require_km_range(km_start: Decimal, km_end: Decimal) -> None:
    if km_end < km_start:
        raise ValueError("km_end must be greater than or equal to km_start")


class TimestampRead(ORMModel):
    created_at: datetime
    updated_at: datetime
