from datetime import date

from pydantic import ConfigDict, Field

from app.schemas.common import PositiveMinutes, SchemaModel, TimestampRead
from app.schemas.enums import DefectSeverity, DefectStatus, Department


class DefectBase(SchemaModel):
    asset_id: int = Field(gt=0)
    department: Department
    defect_type: str = Field(min_length=1, max_length=80)
    defect_severity: DefectSeverity
    detected_date: date
    detected_by: str = Field(min_length=1, max_length=80)
    status: DefectStatus = "open"
    recommended_action: str = Field(min_length=1)
    estimated_work_duration_min: PositiveMinutes
    max_allowed_delay_days: int = Field(ge=0)
    source_system: str = Field(min_length=1, max_length=40)
    source_defect_id: str = Field(min_length=1, max_length=64)


class DefectCreate(DefectBase):
    pass


class DefectRead(DefectBase, TimestampRead):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    defect_id: int = Field(gt=0)
