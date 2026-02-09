"""Branch management and sync endpoints."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.analysis.graph_builder import build_graph
from backend.analysis.incremental import compare_branches, get_branches, get_changed_files, switch_branch
from backend.database import get_session
from backend.models import BranchSnapshot, Edge, Node, Project

router = APIRouter(prefix="/api/project", tags=["branches"])


class BranchSwitchRequest(BaseModel):
    branch: str


class BranchCompareRequest(BaseModel):
    branch_a: str
    branch_b: str


@router.get("/{project_id}/branches")
async def list_branches(project_id: str, session: AsyncSession = Depends(get_session)):
    """List local git branches."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    branches = get_branches(project.path)
    return {"branches": branches}


@router.post("/{project_id}/branch/switch")
async def switch_to_branch(
    project_id: str, req: BranchSwitchRequest, session: AsyncSession = Depends(get_session)
):
    """Switch branch, load cached snapshot or run full analysis."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Save current branch snapshot before switching
    current_branches = get_branches(project.path)
    current_branch = next((b["name"] for b in current_branches if b["current"]), None)
    if current_branch:
        await _save_snapshot(project_id, current_branch, session)

    # Switch branch
    result = switch_branch(project.path, req.branch)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Check for cached snapshot
    snapshot = await session.execute(
        select(BranchSnapshot).where(
            BranchSnapshot.project_id == project_id,
            BranchSnapshot.branch_name == req.branch,
        )
    )
    cached = snapshot.scalar_one_or_none()

    if cached:
        return {
            "success": True,
            "branch": req.branch,
            "from_cache": True,
            "nodes": json.loads(cached.nodes_json),
            "edges": json.loads(cached.edges_json),
        }

    # No cache — full analysis
    graph = build_graph(project.path)

    # Store nodes and edges in DB (replace existing)
    await session.execute(
        Edge.__table__.delete().where(Edge.project_id == project_id)
    )
    await session.execute(
        Node.__table__.delete().where(Node.project_id == project_id)
    )

    for node_data in graph["nodes"]:
        session.add(Node(
            id=node_data["id"], project_id=project_id,
            name=node_data["name"], type=node_data["type"],
            language=node_data["language"], file_path=node_data["file_path"],
            line_start=node_data["line_start"], line_end=node_data["line_end"],
            code_hash=node_data["code_hash"], parent_id=node_data["parent_id"],
            metadata_json=node_data["metadata"],
        ))
    for edge_data in graph["edges"]:
        session.add(Edge(
            project_id=project_id, source_id=edge_data["source_id"],
            target_id=edge_data["target_id"], type=edge_data["type"],
            metadata_json=edge_data["metadata"],
        ))

    project.stats_json = json.dumps(graph["stats"])
    await session.commit()

    return {
        "success": True,
        "branch": req.branch,
        "from_cache": False,
        "stats": graph["stats"],
    }


@router.post("/{project_id}/branch/compare")
async def compare_branch(
    project_id: str, req: BranchCompareRequest, session: AsyncSession = Depends(get_session)
):
    """Compare two branches and return diff overlay data."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = compare_branches(project.path, req.branch_a, req.branch_b)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/{project_id}/sync")
async def sync_project(project_id: str, session: AsyncSession = Depends(get_session)):
    """Run git diff, incremental re-analysis, return change summary."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get changes
    changes = get_changed_files(project.path)
    total_changed = len(changes["added"]) + len(changes["modified"]) + len(changes["deleted"])

    if total_changed == 0:
        return {"summary": "No changes detected", "changes": changes}

    # Rebuild graph (v1: always full rebuild for correctness)
    graph = build_graph(project.path)

    # Replace nodes and edges
    await session.execute(Edge.__table__.delete().where(Edge.project_id == project_id))
    await session.execute(Node.__table__.delete().where(Node.project_id == project_id))

    for node_data in graph["nodes"]:
        session.add(Node(
            id=node_data["id"], project_id=project_id,
            name=node_data["name"], type=node_data["type"],
            language=node_data["language"], file_path=node_data["file_path"],
            line_start=node_data["line_start"], line_end=node_data["line_end"],
            code_hash=node_data["code_hash"], parent_id=node_data["parent_id"],
            metadata_json=node_data["metadata"],
        ))
    for edge_data in graph["edges"]:
        session.add(Edge(
            project_id=project_id, source_id=edge_data["source_id"],
            target_id=edge_data["target_id"], type=edge_data["type"],
            metadata_json=edge_data["metadata"],
        ))

    project.stats_json = json.dumps(graph["stats"])
    project.last_synced = datetime.now(timezone.utc)
    await session.commit()

    # Build summary
    parts = []
    if changes["added"]:
        parts.append(f"{len(changes['added'])} files added")
    if changes["modified"]:
        parts.append(f"{len(changes['modified'])} files updated")
    if changes["deleted"]:
        parts.append(f"{len(changes['deleted'])} files removed")

    return {
        "summary": "Synced: " + ", ".join(parts),
        "changes": changes,
        "stats": graph["stats"],
    }


async def _save_snapshot(project_id: str, branch_name: str, session: AsyncSession):
    """Save current graph as a branch snapshot."""
    from backend.utils import generate_id

    nodes_result = await session.execute(select(Node).where(Node.project_id == project_id))
    edges_result = await session.execute(select(Edge).where(Edge.project_id == project_id))

    nodes = nodes_result.scalars().all()
    edges = edges_result.scalars().all()

    nodes_json = json.dumps([{
        "id": n.id, "name": n.name, "type": n.type, "language": n.language,
        "file_path": n.file_path, "line_start": n.line_start, "line_end": n.line_end,
        "code_hash": n.code_hash, "parent_id": n.parent_id,
        "metadata_json": n.metadata_json,
    } for n in nodes])

    edges_json = json.dumps([{
        "source_id": e.source_id, "target_id": e.target_id,
        "type": e.type, "metadata_json": e.metadata_json,
    } for e in edges])

    # Upsert snapshot
    existing = await session.execute(
        select(BranchSnapshot).where(
            BranchSnapshot.project_id == project_id,
            BranchSnapshot.branch_name == branch_name,
        )
    )
    snap = existing.scalar_one_or_none()
    if snap:
        snap.nodes_json = nodes_json
        snap.edges_json = edges_json
        snap.created_at = datetime.now(timezone.utc)
    else:
        session.add(BranchSnapshot(
            id=generate_id(),
            project_id=project_id,
            branch_name=branch_name,
            nodes_json=nodes_json,
            edges_json=edges_json,
        ))
