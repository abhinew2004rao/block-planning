from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.block_task import BlockTask
    from app.models.defect import Defect


class MaintenanceTask(TimestampMixin, Base):
    __tablename__ = "maintenance_tasks"
    __table_args__ = (
        CheckConstraint(
            "priority_score >= 0 AND priority_score <= 100",
            name="ck_tasks_priority_range",
        ),
        CheckConstraint(
            "failure_prob_7d >= 0 AND failure_prob_7d <= 1",
            name="ck_tasks_fail_prob_7d",
        ),
        CheckConstraint(
            "failure_prob_30d >= 0 AND failure_prob_30d <= 1",
            name="ck_tasks_fail_prob_30d",
        ),
        CheckConstraint(
            "failure_prob_30d >= failure_prob_7d",
            name="ck_tasks_fail_prob_horizon",
        ),
        CheckConstraint(
            "urgency_score >= 0 AND urgency_score <= 100",
            name="ck_tasks_urgency_range",
        ),
        CheckConstraint("estimated_duration_min > 0", name="ck_tasks_duration_positive"),
        CheckConstraint("latest_end_date >= earliest_start_date", name="ck_tasks_date_window"),
        CheckConstraint(
            "preferred_shift IN ('day', 'night', 'any')",
            name="ck_tasks_preferred_shift",
        ),
        CheckConstraint(
            "status IN ('pending', 'scored', 'scheduled', 'in_progress', 'completed', 'cancelled')",
            name="ck_tasks_status",
        ),
        Index("ix_tasks_asset_status", "asset_id", "status"),
        Index("ix_tasks_dept_priority", "department", "priority_score"),
        Index("ix_tasks_window", "earliest_start_date", "latest_end_date"),
        Index("ix_tasks_linked_defect", "linked_defect_id"),
    )

    task_id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(
        ForeignKey("assets.asset_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    department: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    linked_defect_id: Mapped[int | None] = mapped_column(
        ForeignKey("defects.defect_id", ondelete="SET NULL"),
        nullable=True,
    )
    priority_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    failure_prob_7d: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    failure_prob_30d: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    urgency_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    estimated_duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    earliest_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    latest_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    preferred_shift: Mapped[str] = mapped_column(String(16), nullable=False, default="any")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    source_system: Mapped[str] = mapped_column(String(40), nullable=False)

    asset: Mapped["Asset"] = relationship(back_populates="maintenance_tasks")
    linked_defect: Mapped["Defect | None"] = relationship(back_populates="maintenance_tasks")
    block_assignments: Mapped[list["BlockTask"]] = relationship(back_populates="task")
