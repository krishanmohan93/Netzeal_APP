"""
Collaboration / Apply feature routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, CollaborationRequest, CollaborationStatus
from ..schemas.collab import CollabCreate, CollabResponse

router = APIRouter(prefix="/collab", tags=["Collaboration"])


@router.post("/apply", response_model=CollabResponse, status_code=status.HTTP_201_CREATED)
async def create_collab_request(
    payload: CollabCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot apply to yourself")

    to_user = db.query(User).filter(User.id == payload.to_user_id).first()
    if not to_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    req = CollaborationRequest(
        from_user_id=current_user.id,
        to_user_id=payload.to_user_id,
        topic=payload.topic,
        message=payload.message,
        status=CollaborationStatus.PENDING,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/incoming", response_model=List[CollabResponse])
async def list_incoming(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(CollaborationRequest).filter(CollaborationRequest.to_user_id == current_user.id).order_by(CollaborationRequest.created_at.desc()).all()
    return rows


@router.get("/outgoing", response_model=List[CollabResponse])
async def list_outgoing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(CollaborationRequest).filter(CollaborationRequest.from_user_id == current_user.id).order_by(CollaborationRequest.created_at.desc()).all()
    return rows


@router.post("/{request_id}/status", response_model=CollabResponse)
async def update_status(
    request_id: int,
    status_value: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(CollaborationRequest).filter(CollaborationRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    if row.to_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the recipient can change status")
    try:
        row.status = CollaborationStatus(status_value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid status")
    db.commit()
    db.refresh(row)
    return row
