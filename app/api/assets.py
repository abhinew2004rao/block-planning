from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Asset
from app.schemas.asset import AssetCreate, AssetRead

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetRead], summary="Get all assets (paginated)")
@router.get("/", response_model=list[AssetRead], include_in_schema=False)
def list_assets(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get all assets with pagination."""
    return db.query(Asset).offset(skip).limit(limit).all()


@router.get("/{asset_id}", response_model=AssetRead, summary="Get specific asset")
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
):
    """Get specific asset by asset_id."""
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset with id {asset_id} not found")
    return asset


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED, summary="Create new asset")
@router.post("/", response_model=AssetRead, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_asset(
    asset_in: AssetCreate,
    db: Session = Depends(get_db),
):
    """Create a new asset."""
    asset = Asset(**asset_in.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/{asset_id}", response_model=AssetRead, summary="Update asset")
def update_asset(
    asset_id: int,
    asset_in: AssetCreate,
    db: Session = Depends(get_db),
):
    """Update an existing asset."""
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset with id {asset_id} not found")

    for field, val in asset_in.model_dump().items():
        setattr(asset, field, val)

    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_200_OK, summary="Delete asset")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
):
    """Delete an asset by asset_id."""
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset with id {asset_id} not found")
    db.delete(asset)
    db.commit()
    return {"message": f"Asset {asset_id} successfully deleted"}
