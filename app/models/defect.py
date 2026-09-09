from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.maintenance_task import MaintenanceTask


class Defect(TimestampMixin, Base):
    __tablename__ = "defects"
    __table_args__ = (
        UniqueConstraint("source_system", "source_defect_id", name="uq_defects_source"),
        CheckConstraint(
            "defect_severity IN ('critical', 'major', 'minor', 'observational')",
            name="ck_defects_severity",
        ),
        CheckConstraint(
            "status IN ('open', 'acknowledged', 'in_progress', 'deferred', 'closed')",
            name="ck_defects_status",
        ),
        CheckConstraint("estimated_work_duration_min > 0", name="ck_defects_duration_positive"),
        CheckConstraint("max_allowed_delay_days >= 0", name="ck_defects_delay_nonnegative"),
        Index("ix_defects_asset_status", "asset_id", "status"),
        Index("ix_defects_dept_severity", "department", "defect_severity"),
        Index("ix_defects_detected_date", "detected_date"),
    )

    defect_id: Mapped[int] = mapped_column(primary_key=True)
    asset_id: Mapped[int] = mapped_column(
        ForeignKey("assets.asset_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    department: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    defect_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    defect_severity: Mapped[str] = mapped_column(String(24), nullable=False)
    detected_date: Mapped[date] = mapped_column(Date, nullable=False)
    detected_by: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="open")
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_work_duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    max_allowed_delay_days: Mapped[int] = mapped_column(Integer, nullable=False)
    source_system: Mapped[str] = mapped_column(String(40), nullable=False)
    source_defect_id: Mapped[str] = mapped_column(String(64), nullable=False)

    asset: Mapped["Asset"] = relationship(back_populates="defects")
    maintenance_tasks: Mapped[list["MaintenanceTask"]] = relationship(back_populates="linked_defect")
