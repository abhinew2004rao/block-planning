from datetime import date, time
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, Index, Integer, Numeric, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin


class CorridorWindow(TimestampMixin, Base):
    __tablename__ = "corridor_windows"
    __table_args__ = (
        CheckConstraint("km_end >= km_start", name="ck_windows_km_range"),
        CheckConstraint("max_duration_min > 0", name="ck_windows_duration_positive"),
        CheckConstraint(
            "train_impact_score >= 0 AND train_impact_score <= 100",
            name="ck_windows_train_impact",
        ),
        CheckConstraint(
            "block_type_allowed IN ('absolute', 'caution', 'power', 'any')",
            name="ck_windows_block_type_allowed",
        ),
        CheckConstraint(
            "freight_traffic_level IN ('low', 'medium', 'high', 'very_high')",
            name="ck_windows_freight_level",
        ),
        Index("ix_windows_corridor_date", "corridor_id", "valid_date"),
        Index("ix_windows_section_km", "section_code", "km_start", "km_end"),
        Index("ix_windows_valid_slot", "valid_date", "start_time", "end_time"),
    )

    window_id: Mapped[int] = mapped_column(primary_key=True)
    corridor_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    section_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    km_start: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    km_end: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    valid_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    block_type_allowed: Mapped[str] = mapped_column(String(24), nullable=False)
    max_duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    train_impact_score: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    freight_traffic_level: Mapped[str] = mapped_column(String(16), nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
