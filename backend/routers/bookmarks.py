"""Bookmark CRUD endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_session
from backend.models import Bookmark
from backend.utils import generate_id

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


class BookmarkCreate(BaseModel):
    project_id: str
    label: str
    state: dict  # {file, tab, zoom, selectedNode, position}


@router.get("")
async def list_bookmarks(session: AsyncSession = Depends(get_session)):
    """List all bookmarks."""
    result = await session.execute(select(Bookmark).order_by(Bookmark.created_at.desc()))
    bookmarks = result.scalars().all()

    import json
    return [
        {
            "id": b.id,
            "project_id": b.project_id,
            "label": b.label,
            "state": json.loads(b.state_json),
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in bookmarks
    ]


@router.post("")
async def create_bookmark(req: BookmarkCreate, session: AsyncSession = Depends(get_session)):
    """Save a bookmark with label + view state."""
    import json
    bookmark = Bookmark(
        id=generate_id(),
        project_id=req.project_id,
        label=req.label,
        state_json=json.dumps(req.state),
    )
    session.add(bookmark)
    await session.commit()
    return {"id": bookmark.id, "label": bookmark.label}


@router.delete("/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a bookmark."""
    bookmark = await session.get(Bookmark, bookmark_id)
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    await session.delete(bookmark)
    await session.commit()
    return {"deleted": True}
