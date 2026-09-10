from datetime import date

from pydantic import ConfigDict, Field, model_validator

from app.schemas.common import PositiveMinutes, Probability, SchemaModel, Score100, TimestampRead
from app.schemas.enums import Department, PreferredShift, TaskStatus


class MaintenanceTaskBase(SchemaModel):
    asset_id: int = Field(gt=0)
    department: Department
    task_type: str = Field(min_length=1, max_length=80)
    linked_defect_id: int | None = Field(default=None, gt=0)
    priority_score: Score100 = 0.0
    failure_prob_7d: Probability = 0.0
    failure_prob_30d: Probability = 0.0
    urgency_score: Score100 = 0.0
    estimated_duration_min: PositiveMinutes
    earliest_start_date: date
    latest_end_date: date
    preferred_shift: PreferredShift = "any"
    status: TaskStatus = "pending"
    source_system: str = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def validate_windows_and_probabilities(self) -> "MaintenanceTaskBase":
        if self.latest_end_date < self.earliest_start_date:
            raise ValueError("latest_end_date must be on or after earliest_start_date")
        if self.failure_prob_30d < self.failure_prob_7d:
            raise ValueError("failure_prob_30d must be greater than or equal to failure_prob_7d")
        return self


class MaintenanceTaskCreate(MaintenanceTaskBase):
    pass


class TaskStatusUpdate(SchemaModel):
    status: TaskStatus


class MaintenanceTaskRead(MaintenanceTaskBase, TimestampRead):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)
    task_id: int = Field(gt=0)
