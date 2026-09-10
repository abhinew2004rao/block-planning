from datetime import date
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Block, BlockTask
from app.schemas.block import BlockCreate, BlockRead, BlockStatusUpdate
from app.schemas.block_task import BlockTaskRead
from app.schemas.enums import BlockStatus
from app.services.csv_export import export_blocks_csv

router = APIRouter(prefix="/blocks", tags=["blocks"])


@router.get("", response_model=list[BlockRead], summary="Get all blocks (paginated)")
@router.get("/", response_model=list[BlockRead], include_in_schema=False)
def list_blocks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get all blocks with pagination."""
    return db.query(Block).offset(skip).limit(limit).all()


@router.get("/export/csv", summary="Export blocks to CSV format")
def export_blocks_csv_endpoint(
    start_date: date | None = Query(None, description="Optional start date filter"),
    end_date: date | None = Query(None, description="Optional end date filter"),
    db: Session = Depends(get_db),
):
    """Export blocks to CSV format."""
    csv_content = export_blocks_csv(db)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="blocks.csv"'},
    )


@router.get("/{block_id}", response_model=BlockRead, summary="Get specific block")
def get_block(
    block_id: int,
    db: Session = Depends(get_db),
):
    """Get specific block by block_id."""
    block = db.query(Block).filter(Block.block_id == block_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Block with id {block_id} not found")
    return block


@router.get("/{block_id}/tasks", response_model=list[BlockTaskRead], summary="Get tasks for a block")
def get_block_tasks_endpoint(
    block_id: int,
    db: Session = Depends(get_db),
):
    """Get tasks assigned to a specific block."""
    block = db.query(Block).filter(Block.block_id == block_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Block with id {block_id} not found")
    return db.query(BlockTask).filter(BlockTask.block_id == block_id).order_by(BlockTask.sequence_order).all()


@router.post("", response_model=BlockRead, status_code=status.HTTP_201_CREATED, summary="Create new block (admin only)")
@router.post("/", response_model=BlockRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_block(
    block_in: BlockCreate,
    db: Session = Depends(get_db),
):
    """Create a new block (admin/scheduler endpoint)."""
    block = Block(**block_in.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.put("/{block_id}/status", response_model=BlockRead, summary="Update block status")
def update_block_status(
    block_id: int,
    status_update: BlockStatusUpdate = Body(...),
    db: Session = Depends(get_db),
):
    """Update status of a block."""
    block = db.query(Block).filter(Block.block_id == block_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Block with id {block_id} not found")

    block.status = status_update.status
    db.commit()
    db.refresh(block)
    return block


@router.delete("/{block_id}", status_code=status.HTTP_200_OK, summary="Delete block")
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
):
    """Delete a block by block_id."""
    block = db.query(Block).filter(Block.block_id == block_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Block with id {block_id} not found")

    # Delete associated task assignments and reset task status back to pending
    for assignment in block.block_tasks:
        if assignment.task:
            assignment.task.status = "pending"

    db.delete(block)
    db.commit()
    return {"message": f"Block {block_id} successfully deleted"}
