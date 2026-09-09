from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.block import Block
    from app.models.maintenance_task import MaintenanceTask


class BlockTask(Base):
    __tablename__ = "block_tasks"
    __table_args__ = (
        UniqueConstraint("block_id", "task_id", name="uq_block_tasks_block_task"),
        UniqueConstraint("block_id", "sequence_order", name="uq_block_tasks_sequence"),
        CheckConstraint("planned_duration_min > 0", name="ck_block_tasks_duration_positive"),
        CheckConstraint("sequence_order >= 1", name="ck_block_tasks_sequence_order"),
        Index("ix_block_tasks_task_id", "task_id"),
        Index("ix_block_tasks_department", "department"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    block_id: Mapped[int] = mapped_column(
        ForeignKey("blocks.block_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_tasks.task_id", ondelete="RESTRICT"),
        nullable=False,
    )
    department: Mapped[str] = mapped_column(String(32), nullable=False)
    planned_duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    block: Mapped["Block"] = relationship(back_populates="block_tasks")
    task: Mapped["MaintenanceTask"] = relationship(back_populates="block_assignments")
