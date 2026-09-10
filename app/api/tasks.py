from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MaintenanceTask
from app.schemas.maintenance_task import MaintenanceTaskCreate, MaintenanceTaskRead, TaskStatusUpdate
from app.services.ml_scoring import score_all_tasks

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[MaintenanceTaskRead], summary="Get all tasks (paginated)")
@router.get("/", response_model=list[MaintenanceTaskRead], include_in_schema=False)
def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get all maintenance tasks with pagination."""
    return db.query(MaintenanceTask).offset(skip).limit(limit).all()


@router.get("/backlog", response_model=list[MaintenanceTaskRead], summary="Get backlog tasks")
def get_backlog_tasks(
    status: str = Query("pending", description="Task status filter (default: pending)"),
    department: str | None = Query(None, description="Filter by department"),
    min_priority: float | None = Query(None, ge=0, le=100, description="Minimum priority score filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get backlog tasks filtered by status, department, and minimum priority score."""
    query = db.query(MaintenanceTask)
    if status and status.lower() != "all":
        statuses = [s.strip() for s in status.split(",")]
        query = query.filter(MaintenanceTask.status.in_(statuses))

    if department:
        query = query.filter(MaintenanceTask.department == department)

    if min_priority is not None:
        query = query.filter(MaintenanceTask.priority_score >= min_priority)

    return query.order_by(MaintenanceTask.urgency_score.desc()).offset(skip).limit(limit).all()


@router.get("/{task_id}", response_model=MaintenanceTaskRead, summary="Get specific task")
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    """Get specific task by task_id."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Maintenance task with id {task_id} not found")
    return task


@router.post("", response_model=MaintenanceTaskRead, status_code=status.HTTP_201_CREATED, summary="Create new task")
@router.post("/", response_model=MaintenanceTaskRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_task(
    task_in: MaintenanceTaskCreate,
    db: Session = Depends(get_db),
):
    """Create a new maintenance task."""
    task = MaintenanceTask(**task_in.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=MaintenanceTaskRead, summary="Update task")
def update_task(
    task_id: int,
    task_in: MaintenanceTaskCreate,
    db: Session = Depends(get_db),
):
    """Update an existing maintenance task."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Maintenance task with id {task_id} not found")

    for field, val in task_in.model_dump().items():
        setattr(task, field, val)

    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}/status", response_model=MaintenanceTaskRead, summary="Update task status")
def update_task_status(
    task_id: int,
    status_update: TaskStatusUpdate = Body(...),
    db: Session = Depends(get_db),
):
    """Update status of a maintenance task."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Maintenance task with id {task_id} not found")

    task.status = status_update.status
    db.commit()
    db.refresh(task)
    return task


@router.post("/score", status_code=status.HTTP_200_OK, summary="Run ML scoring on tasks")
def score_maintenance_tasks(
    update_status: bool = Query(False, description="Update task status from pending to scored"),
    db: Session = Depends(get_db),
):
    """Run ML scoring service on all maintenance tasks in database."""
    scored_tasks = score_all_tasks(db=db, update_status=update_status)
    return {
        "message": f"Successfully scored {len(scored_tasks)} task(s)",
        "tasks_scored": len(scored_tasks),
    }


@router.delete("/{task_id}", status_code=status.HTTP_200_OK, summary="Delete task")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    """Delete a maintenance task by task_id."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Maintenance task with id {task_id} not found")
    db.delete(task)
    db.commit()
    return {"message": f"Task {task_id} successfully deleted"}
