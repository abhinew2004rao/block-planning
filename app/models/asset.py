from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.defect import Defect
    from app.models.maintenance_task import MaintenanceTask


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"
    __table_args__ = (
        CheckConstraint("km_end >= km_start", name="ck_assets_km_range"),
        CheckConstraint(
            "line_category IN ('A', 'B', 'C', 'D', 'E', 'DFC', 'suburban')",
            name="ck_assets_line_category",
        ),
        CheckConstraint(
            "traffic_density_class IN ('A', 'B', 'C', 'D', 'E')",
            name="ck_assets_traffic_density_class",
        ),
        Index("ix_assets_division_section", "division_code", "section_code"),
        Index("ix_assets_corridor_km", "corridor_id", "km_start", "km_end"),
        Index("ix_assets_type_subtype", "asset_type", "sub_type"),
    )

    asset_id: Mapped[int] = mapped_column(primary_key=True)
    asset_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    sub_type: Mapped[str] = mapped_column(String(60), nullable=False)
    division_code: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    section_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    corridor_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    km_start: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    km_end: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    line_category: Mapped[str] = mapped_column(String(16), nullable=False)
    traffic_density_class: Mapped[str] = mapped_column(String(8), nullable=False)

    defects: Mapped[list["Defect"]] = relationship(back_populates="asset")
    maintenance_tasks: Mapped[list["MaintenanceTask"]] = relationship(back_populates="asset")
