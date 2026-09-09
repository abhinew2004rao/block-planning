from pydantic import ConfigDict, Field, model_validator

from app.schemas.common import KmChainage, SchemaModel, TimestampRead, require_km_range
from app.schemas.enums import LineCategory, TrafficDensityClass


class AssetBase(SchemaModel):
    asset_type: str = Field(min_length=1, max_length=40)
    sub_type: str = Field(min_length=1, max_length=60)
    division_code: str = Field(min_length=1, max_length=16)
    section_code: str = Field(min_length=1, max_length=32)
    corridor_id: str = Field(min_length=1, max_length=40)
    km_start: KmChainage
    km_end: KmChainage
    line_category: LineCategory
    traffic_density_class: TrafficDensityClass

    @model_validator(mode="after")
    def validate_km_range(self) -> "AssetBase":
        require_km_range(self.km_start, self.km_end)
        return self


class AssetCreate(AssetBase):
    pass


class AssetRead(AssetBase, TimestampRead):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    asset_id: int = Field(gt=0)
