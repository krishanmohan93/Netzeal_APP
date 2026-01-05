"""Pydantic schemas for collaboration (apply) feature"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CollabCreate(BaseModel):
    to_user_id: int
    topic: Optional[str] = Field(default=None, max_length=200)
    message: Optional[str] = Field(default=None, max_length=2000)


class CollabResponse(BaseModel):
    id: int
    from_user_id: int
    to_user_id: int
    topic: Optional[str]
    message: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
