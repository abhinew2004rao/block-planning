from datetime import date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Block, BlockTask, MaintenanceTask
from app.services.csv_export import export_all_to_csv
from app.services.optimizer import optimize_blocks

router = APIRouter(prefix="/optimization", tags=["optimization"])


@router.post("/run", status_code=status.HTTP_200_OK, summary="Run optimizer")
@router.post("/run/", status_code=status.HTTP_200_OK, include_in_schema=False)
def run_optimization_endpoint(
    start_date: date | None = Query(None, description="Optimization horizon start date"),
    end_date: date | None = Query(None, description="Optimization horizon end date"),
    horizon: str = Query("weekly", description="Optimization horizon (weekly, monthly, daily)"),
    replace_planned: bool = Query(True, description="Replace existing planned blocks"),
    db: Session = Depends(get_db),
):
    """Run block optimization service on maintenance tasks and corridor windows."""
    result = optimize_blocks(db, replace_planned=replace_planned)
    return {
        "status": "success",
        "horizon": horizon,
        "blocks_created": result.get("blocks_created", 0),
        "tasks_scheduled": result.get("tasks_scheduled", 0),
    }


@router.post("/export-csv", status_code=status.HTTP_200_OK, summary="Export results to CSV")
@router.post("/export-csv/", status_code=status.HTTP_200_OK, include_in_schema=False)
def export_optimization_csv_endpoint(
    output_dir: str = Query("data/output", description="Target directory for exported CSV files"),
    db: Session = Depends(get_db),
):
    """Export optimization results (blocks, block_tasks, task_schedule) to CSV files."""
    exported_files = export_all_to_csv(db, output_dir=output_dir)
    return {
        "status": "success",
        "exported_files": exported_files,
        "blocks": exported_files.get("blocks"),
        "block_tasks": exported_files.get("block_tasks"),
        "task_schedule": exported_files.get("task_schedule"),
    }


@router.get("/stats", status_code=status.HTTP_200_OK, summary="Get optimization statistics")
@router.get("/stats/", status_code=status.HTTP_200_OK, include_in_schema=False)
@router.get("/status", status_code=status.HTTP_200_OK, include_in_schema=False)
def get_optimization_stats(
    db: Session = Depends(get_db),
):
    """Get optimization statistics including total blocks, scheduled tasks, and average train impact."""
    all_blocks = db.query(Block).all()
    total_blocks = len(all_blocks)

    if total_blocks > 0:
        total_impact = sum(float(b.estimated_train_impact) for b in all_blocks if b.estimated_train_impact is not None)
        avg_train_impact = round(total_impact / total_blocks, 2)
    else:
        avg_train_impact = 0.0

    scheduled_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.status == "scheduled").count()
    pending_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.status.in_(["pending", "scored"])).count()
    multi_dept_count = sum(1 for b in all_blocks if b.departments_involved and len(b.departments_involved) > 1)

    return {
        "total_blocks": total_blocks,
        "tasks_scheduled": scheduled_tasks,
        "avg_train_impact": avg_train_impact,
        "pending_backlog_tasks": pending_tasks,
        "multi_department_blocks": multi_dept_count,
    }
