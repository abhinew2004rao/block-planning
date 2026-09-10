"""CSV export service for exporting maintenance blocks, task assignments, and schedule data."""

from __future__ import annotations

from datetime import date, datetime, time
from io import StringIO
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session, joinedload

from app.models import Block, BlockTask, MaintenanceTask


BLOCK_COLUMNS = [
    "block_id",
    "corridor_id",
    "section_code",
    "km_start",
    "km_end",
    "block_date",
    "start_time",
    "end_time",
    "duration_min",
    "block_type",
    "departments_involved",
    "status",
    "planned_tasks_count",
    "estimated_train_impact",
    "created_by",
    "created_at",
    "updated_at",
]

BLOCK_TASK_COLUMNS = [
    "id",
    "block_id",
    "task_id",
    "department",
    "planned_duration_min",
    "sequence_order",
    "created_at",
]

TASK_SCHEDULE_COLUMNS = [
    "assignment_id",
    "block_id",
    "task_id",
    "sequence_order",
    "planned_duration_min",
    "block_date",
    "start_time",
    "end_time",
    "block_type",
    "block_status",
    "section_code",
    "corridor_id",
    "km_start",
    "km_end",
    "department",
    "task_type",
    "priority_score",
    "failure_prob_7d",
    "urgency_score",
    "preferred_shift",
    "task_status",
    "asset_id",
    "asset_type",
    "sub_type",
    "linked_defect_id",
    "defect_severity",
]


def _format_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (list, set, tuple)):
        return ", ".join(str(x) for x in val)
    try:
        if pd.isna(val):
            return ""
    except Exception:
        pass
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    if isinstance(val, time):
        return val.strftime("%H:%M:%S")
    return str(val)


def _ensure_output_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _blocks_frame(db: Session) -> pd.DataFrame:
    blocks = db.query(Block).order_by(Block.block_id).all()
    rows = []
    for b in blocks:
        depts = b.departments_involved
        if isinstance(depts, list):
            depts_str = ", ".join(str(d) for d in depts)
        else:
            depts_str = _format_str(depts)

        rows.append(
            {
                "block_id": b.block_id,
                "corridor_id": b.corridor_id,
                "section_code": b.section_code,
                "km_start": f"{float(b.km_start):.3f}" if b.km_start is not None else "",
                "km_end": f"{float(b.km_end):.3f}" if b.km_end is not None else "",
                "block_date": _format_str(b.block_date),
                "start_time": _format_str(b.start_time),
                "end_time": _format_str(b.end_time),
                "duration_min": b.duration_min,
                "block_type": b.block_type,
                "departments_involved": depts_str,
                "status": b.status,
                "planned_tasks_count": b.planned_tasks_count,
                "estimated_train_impact": f"{float(b.estimated_train_impact):.2f}" if b.estimated_train_impact is not None else "0.00",
                "created_by": b.created_by,
                "created_at": _format_str(b.created_at),
                "updated_at": _format_str(b.updated_at),
            }
        )
    return pd.DataFrame(rows, columns=BLOCK_COLUMNS)


def _block_tasks_frame(db: Session) -> pd.DataFrame:
    assignments = db.query(BlockTask).order_by(BlockTask.block_id, BlockTask.sequence_order).all()
    rows = []
    for bt in assignments:
        rows.append(
            {
                "id": bt.id,
                "block_id": bt.block_id,
                "task_id": bt.task_id,
                "department": bt.department,
                "planned_duration_min": bt.planned_duration_min,
                "sequence_order": bt.sequence_order,
                "created_at": _format_str(bt.created_at),
            }
        )
    return pd.DataFrame(rows, columns=BLOCK_TASK_COLUMNS)


def _task_schedule_frame(db: Session) -> pd.DataFrame:
    assignments = (
        db.query(BlockTask)
        .options(
            joinedload(BlockTask.block),
            joinedload(BlockTask.task).joinedload(MaintenanceTask.asset),
            joinedload(BlockTask.task).joinedload(MaintenanceTask.linked_defect),
        )
        .order_by(BlockTask.block_id, BlockTask.sequence_order)
        .all()
    )
    rows = []
    for bt in assignments:
        b = bt.block
        t = bt.task
        asset = t.asset if t else None
        defect = t.linked_defect if t else None

        rows.append(
            {
                "assignment_id": bt.id,
                "block_id": bt.block_id,
                "task_id": bt.task_id,
                "sequence_order": bt.sequence_order,
                "planned_duration_min": bt.planned_duration_min,
                "block_date": _format_str(b.block_date if b else None),
                "start_time": _format_str(b.start_time if b else None),
                "end_time": _format_str(b.end_time if b else None),
                "block_type": b.block_type if b else "",
                "block_status": b.status if b else "",
                "section_code": b.section_code if b else (asset.section_code if asset else ""),
                "corridor_id": b.corridor_id if b else (asset.corridor_id if asset else ""),
                "km_start": f"{float(b.km_start):.3f}" if b and b.km_start is not None else "",
                "km_end": f"{float(b.km_end):.3f}" if b and b.km_end is not None else "",
                "department": bt.department,
                "task_type": t.task_type if t else "",
                "priority_score": round(float(t.priority_score), 2) if t and t.priority_score is not None else 0.0,
                "failure_prob_7d": round(float(t.failure_prob_7d), 4) if t and t.failure_prob_7d is not None else 0.0,
                "urgency_score": round(float(t.urgency_score), 2) if t and t.urgency_score is not None else 0.0,
                "preferred_shift": t.preferred_shift if t else "",
                "task_status": t.status if t else "",
                "asset_id": t.asset_id if t else "",
                "asset_type": asset.asset_type if asset else "",
                "sub_type": asset.sub_type if asset else "",
                "linked_defect_id": t.linked_defect_id if t else "",
                "defect_severity": defect.defect_severity if defect else "",
            }
        )
    return pd.DataFrame(rows, columns=TASK_SCHEDULE_COLUMNS)


def dataframe_to_csv(df: pd.DataFrame) -> str:
    buffer = StringIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue()


def export_blocks_csv(db: Session, output_path: str | Path | None = None) -> str:
    """Export blocks from database to CSV string and save to blocks.csv."""
    df = _blocks_frame(db)
    csv_text = dataframe_to_csv(df)

    target_path = Path(output_path) if output_path else Path("data/output/blocks.csv")
    _ensure_output_dir(target_path)
    target_path.write_text(csv_text, encoding="utf-8")
    return csv_text


def export_block_tasks_csv(db: Session, output_path: str | Path | None = None) -> str:
    """Export block_tasks from database to CSV string and save to block_tasks.csv."""
    df = _block_tasks_frame(db)
    csv_text = dataframe_to_csv(df)

    target_path = Path(output_path) if output_path else Path("data/output/block_tasks.csv")
    _ensure_output_dir(target_path)
    target_path.write_text(csv_text, encoding="utf-8")
    return csv_text


def export_task_schedule_csv(db: Session, output_path: str | Path | None = None) -> str:
    """Export joined task_schedule data from database to CSV string and save to task_schedule.csv."""
    df = _task_schedule_frame(db)
    csv_text = dataframe_to_csv(df)

    target_path = Path(output_path) if output_path else Path("data/output/task_schedule.csv")
    _ensure_output_dir(target_path)
    target_path.write_text(csv_text, encoding="utf-8")
    return csv_text


def export_all_to_csv(db: Session, output_dir: str | Path = "data/output") -> dict[str, str]:
    """Export blocks, block_tasks, and task_schedule CSVs into output_dir and return dictionary of file paths."""
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    b_path = out_dir / "blocks.csv"
    bt_path = out_dir / "block_tasks.csv"
    ts_path = out_dir / "task_schedule.csv"

    export_blocks_csv(db, b_path)
    export_block_tasks_csv(db, bt_path)
    export_task_schedule_csv(db, ts_path)

    return {
        "blocks": str(b_path),
        "block_tasks": str(bt_path),
        "task_schedule": str(ts_path),
    }
