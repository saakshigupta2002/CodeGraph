"""Export endpoints."""

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_session
from backend.models import Edge, Node, Project

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/{project_id}")
async def export_graph(project_id: str, session: AsyncSession = Depends(get_session)):
    """Export full graph data as JSON."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    nodes_result = await session.execute(select(Node).where(Node.project_id == project_id))
    edges_result = await session.execute(select(Edge).where(Edge.project_id == project_id))

    nodes = nodes_result.scalars().all()
    edges = edges_result.scalars().all()

    data = {
        "project": {
            "id": project.id,
            "name": project.name,
            "stats": json.loads(project.stats_json) if project.stats_json else {},
        },
        "nodes": [
            {
                "id": n.id, "name": n.name, "type": n.type,
                "language": n.language, "file_path": n.file_path,
                "line_start": n.line_start, "line_end": n.line_end,
                "metadata": json.loads(n.metadata_json) if n.metadata_json else {},
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": e.id, "source_id": e.source_id,
                "target_id": e.target_id, "type": e.type,
                "metadata": json.loads(e.metadata_json) if e.metadata_json else {},
            }
            for e in edges
        ],
    }

    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f"attachment; filename=codegraph-{project.name}.json"},
    )
