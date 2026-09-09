from datetime import date, time
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, Index, Integer, Numeric, String, Time
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.block_task import BlockTask


class Block(TimestampMixin, Base):
    __tablename__ = "blocks"
    __table_args__ = (
        CheckConstraint("km_end >= km_start", name="ck_blocks_km_range"),
        CheckConstraint("duration_min > 0", name="ck_blocks_duration_positive"),
        CheckConstraint("planned_tasks_count >= 0", name="ck_blocks_task_count"),
        CheckConstraint(
            "estimated_train_impact >= 0 AND estimated_train_impact <= 100",
            name="ck_blocks_train_impact",
        ),
        CheckConstraint(
            "block_type IN ('absolute', 'caution', 'power')",
            name="ck_blocks_block_type",
        ),
        CheckConstraint(
            "status IN ('draft', 'planned', 'approved', 'in_progress', 'completed', 'cancelled')",
            name="ck_blocks_status",
        ),
        Index("ix_blocks_corridor_date", "corridor_id", "block_date"),
        Index("ix_blocks_section_km", "section_code", "km_start", "km_end"),
        Index("ix_blocks_status_date", "status", "block_date"),
    )

    block_id: Mapped[int] = mapped_column(primary_key=True)
    corridor_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    section_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    km_start: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    km_end: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    block_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    block_type: Mapped[str] = mapped_column(String(24), nullable=False)
    departments_involved: Mapped[list[str]] = mapped_column(ARRAY(String(32)), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="planned", index=True)
    planned_tasks_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_train_impact: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    created_by: Mapped[str] = mapped_column(String(80), nullable=False)

    block_tasks: Mapped[list["BlockTask"]] = relationship(
        back_populates="block",
        cascade="all, delete-orphan",
    )
