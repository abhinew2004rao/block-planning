from __future__ import annotations

from io import StringIO
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Block, BlockTask, MaintenanceTask


def _blocks_frame(db: Session) -> pd.DataFrame:
    blocks = db.query(Block).options(joinedload(Block.corridor_window)).all()
    rows = []
    for block in blocks:
        window = block.corridor_window
        rows.append(
            {
                "block_code": block.block_code,
                "status": block.status,
                "block_type": block.block_type,
                "section": window.section if window else "",
                "corridor": window.corridor_name if window else "",
                "zone": window.zone if window else "",
                "division": window.division if window else "",
                "planned_start": block.planned_start,
                "planned_end": block.planned_end,
                "duration_min": block.duration_min,
                "total_priority": block.total_priority,
                "optimizer_run_id": block.optimizer_run_id,
            }
        )
    return pd.DataFrame(rows)


def _assignments_frame(db: Session) -> pd.DataFrame:
    assignments = (
        db.query(BlockTask)
        .options(
            joinedload(BlockTask.block),
            joinedload(BlockTask.task).joinedload(MaintenanceTask.asset),
        )
        .all()
    )
    rows = []
    for item in assignments:
        task = item.task
        asset = task.asset if task else None
        rows.append(
            {
                "block_code": item.block.block_code if item.block else "",
                "sequence": item.sequence,
                "task_id": item.task_id,
                "task_title": task.title if task else "",
                "task_type": task.task_type if task else "",
                "priority_score": task.priority_score if task else None,
                "allocated_minutes": item.allocated_minutes,
                "asset_code": asset.asset_code if asset else "",
                "section": asset.section if asset else "",
                "km_from": asset.km_from if asset else None,
                "km_to": asset.km_to if asset else None,
            }
        )
    return pd.DataFrame(rows)


def dataframe_to_csv(frame: pd.DataFrame) -> str:
    buffer = StringIO()
    frame.to_csv(buffer, index=False)
    return buffer.getvalue()


def export_blocks_csv(db: Session) -> str:
    return dataframe_to_csv(_blocks_frame(db))


def export_block_tasks_csv(db: Session) -> str:
    return dataframe_to_csv(_assignments_frame(db))


def write_export_files(db: Session) -> dict[str, str]:
    export_dir = Path(settings.export_dir)
    export_dir.mkdir(parents=True, exist_ok=True)
    blocks_path = export_dir / "blocks.csv"
    tasks_path = export_dir / "block_tasks.csv"
    blocks_path.write_text(export_blocks_csv(db), encoding="utf-8")
    tasks_path.write_text(export_block_tasks_csv(db), encoding="utf-8")
    return {"blocks": str(blocks_path), "block_tasks": str(tasks_path)}
