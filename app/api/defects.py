from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Defect
from app.schemas.defect import DefectCreate, DefectRead, DefectStatusUpdate

router = APIRouter(prefix="/defects", tags=["defects"])


@router.get("", response_model=list[DefectRead], summary="Get all defects (paginated)")
@router.get("/", response_model=list[DefectRead], include_in_schema=False)
def list_defects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get all defects with pagination."""
    return db.query(Defect).offset(skip).limit(limit).all()


@router.get("/{defect_id}", response_model=DefectRead, summary="Get specific defect")
def get_defect(
    defect_id: int,
    db: Session = Depends(get_db),
):
    """Get specific defect by defect_id."""
    defect = db.query(Defect).filter(Defect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Defect with id {defect_id} not found")
    return defect


@router.post("", response_model=DefectRead, status_code=status.HTTP_201_CREATED, summary="Create new defect")
@router.post("/", response_model=DefectRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_defect(
    defect_in: DefectCreate,
    db: Session = Depends(get_db),
):
    """Create a new defect."""
    defect = Defect(**defect_in.model_dump())
    db.add(defect)
    db.commit()
    db.refresh(defect)
    return defect


@router.put("/{defect_id}", response_model=DefectRead, summary="Update defect")
def update_defect(
    defect_id: int,
    defect_in: DefectCreate,
    db: Session = Depends(get_db),
):
    """Update an existing defect."""
    defect = db.query(Defect).filter(Defect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Defect with id {defect_id} not found")

    for field, val in defect_in.model_dump().items():
        setattr(defect, field, val)

    db.commit()
    db.refresh(defect)
    return defect


@router.put("/{defect_id}/status", response_model=DefectRead, summary="Update defect status")
def update_defect_status(
    defect_id: int,
    status_update: DefectStatusUpdate = Body(...),
    db: Session = Depends(get_db),
):
    """Update status of a defect."""
    defect = db.query(Defect).filter(Defect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Defect with id {defect_id} not found")

    defect.status = status_update.status
    db.commit()
    db.refresh(defect)
    return defect


@router.delete("/{defect_id}", status_code=status.HTTP_200_OK, summary="Delete defect")
def delete_defect(
    defect_id: int,
    db: Session = Depends(get_db),
):
    """Delete a defect by defect_id."""
    defect = db.query(Defect).filter(Defect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Defect with id {defect_id} not found")
    db.delete(defect)
    db.commit()
    return {"message": f"Defect {defect_id} successfully deleted"}
