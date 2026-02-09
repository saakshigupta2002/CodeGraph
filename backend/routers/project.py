"""Project management endpoints: upload, GitHub import, listing."""

import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.analysis.graph_builder import build_graph
from backend.config import MAX_FILES_WARNING, PROJECTS_DIR, UPLOAD_DIR
from backend.database import get_session
from backend.models import Edge, Node, Project
from backend.utils import build_file_tree, collect_files, generate_id

router = APIRouter(prefix="/api/project", tags=["project"])


class GitHubImportRequest(BaseModel):
    url: str
    pat: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    path: str
    github_url: str | None = None
    created_at: str
    last_synced: str | None = None
    stats: dict | None = None
    warnings: list[str] | None = None


@router.post("/upload", response_model=ProjectResponse)
async def upload_project(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
    """Upload a zip file or folder for analysis."""
    project_id = generate_id()
    project_dir = PROJECTS_DIR / project_id

    try:
        # Save uploaded file
        upload_path = UPLOAD_DIR / file.filename
        with open(upload_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Extract if zip
        if file.filename.endswith(".zip"):
            with zipfile.ZipFile(upload_path, "r") as z:
                z.extractall(project_dir)
            # If zip contains a single root directory, use that
            contents = list(project_dir.iterdir())
            if len(contents) == 1 and contents[0].is_dir():
                inner = contents[0]
                temp = project_dir / "_temp"
                inner.rename(temp)
                for item in temp.iterdir():
                    item.rename(project_dir / item.name)
                temp.rmdir()
            upload_path.unlink(missing_ok=True)
        else:
            # Single file — just move it
            project_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(upload_path), str(project_dir / file.filename))

        return await _analyze_and_store(project_id, str(project_dir), file.filename.replace(".zip", ""), session)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    except Exception as e:
        # Cleanup on failure
        if project_dir.exists():
            shutil.rmtree(project_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/github", response_model=ProjectResponse)
async def import_github(req: GitHubImportRequest, session: AsyncSession = Depends(get_session)):
    """Clone and analyze a GitHub repository."""
    project_id = generate_id()
    project_dir = PROJECTS_DIR / project_id

    try:
        # Build clone URL with PAT if provided
        url = req.url.strip().rstrip("/")
        if not url.endswith(".git"):
            url += ".git"
        if req.pat:
            # Insert PAT into URL
            url = url.replace("https://", f"https://{req.pat}@")

        proc = subprocess.run(
            ["git", "clone", "--depth=1", url, str(project_dir)],
            capture_output=True, text=True, timeout=120,
        )
        if proc.returncode != 0:
            raise HTTPException(status_code=400, detail=f"Git clone failed: {proc.stderr.strip()}")

        # Extract repo name from URL
        name = req.url.strip().rstrip("/").split("/")[-1].replace(".git", "")

        return await _analyze_and_store(project_id, str(project_dir), name, session, github_url=req.url)
    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Clone timed out (>120s)")
    except Exception as e:
        if project_dir.exists():
            shutil.rmtree(project_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("s")
async def list_projects(session: AsyncSession = Depends(get_session)):
    """List all previously analyzed projects."""
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "path": p.path,
            "github_url": p.github_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "last_synced": p.last_synced.isoformat() if p.last_synced else None,
            "stats": json.loads(p.stats_json) if p.stats_json else None,
        }
        for p in projects
    ]


@router.get("/{project_id}/file-tree")
async def get_file_tree(project_id: str, session: AsyncSession = Depends(get_session)):
    """Return the project's folder hierarchy with badges."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tree = build_file_tree(project.path)

    # Augment with node counts from DB
    result = await session.execute(
        select(Node).where(Node.project_id == project_id)
    )
    nodes = result.scalars().all()

    # Build per-file stats
    file_stats = {}
    for node in nodes:
        fp = node.file_path
        if fp not in file_stats:
            file_stats[fp] = {"function_count": 0, "class_count": 0, "has_tests": False}
        if node.type == "function":
            file_stats[fp]["function_count"] += 1
        elif node.type == "class":
            file_stats[fp]["class_count"] += 1

    def augment_tree(tree_node):
        if tree_node["type"] == "file":
            stats = file_stats.get(tree_node["path"], {})
            tree_node["function_count"] = stats.get("function_count", 0)
            tree_node["class_count"] = stats.get("class_count", 0)
        elif tree_node["type"] == "directory" and "children" in tree_node:
            for child in tree_node["children"]:
                augment_tree(child)

    augment_tree(tree)
    return tree


@router.get("/{project_id}/stats")
async def get_stats(project_id: str, session: AsyncSession = Depends(get_session)):
    """Return project overview statistics."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.stats_json:
        return json.loads(project.stats_json)
    return {}


@router.get("/{project_id}/file/{path:path}")
async def get_file_content(project_id: str, path: str, session: AsyncSession = Depends(get_session)):
    """Return full file content with language metadata."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    file_path = Path(project.path) / path
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Security: prevent path traversal
    try:
        file_path.resolve().relative_to(Path(project.path).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        content = file_path.read_text(errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot read file: {e}")

    from backend.utils import get_language
    lang = get_language(str(file_path))

    return {
        "path": path,
        "content": content,
        "language": lang,
        "line_count": content.count("\n") + 1,
    }


async def _analyze_and_store(
    project_id: str,
    project_path: str,
    name: str,
    session: AsyncSession,
    github_url: str | None = None,
) -> ProjectResponse:
    """Analyze a project and store results in the database."""
    # Check file count
    files = collect_files(project_path)
    warnings = []
    if len(files) > MAX_FILES_WARNING:
        warnings.append(
            f"Project has {len(files)} files (>{MAX_FILES_WARNING}). "
            "Consider analyzing specific directories for better performance."
        )

    # Build graph
    graph = build_graph(project_path)
    now = datetime.now(timezone.utc)

    # Store project
    project = Project(
        id=project_id,
        name=name,
        path=project_path,
        github_url=github_url,
        created_at=now,
        last_synced=now,
        stats_json=json.dumps(graph["stats"]),
    )
    session.add(project)

    # Store nodes
    for node_data in graph["nodes"]:
        node = Node(
            id=node_data["id"],
            project_id=project_id,
            name=node_data["name"],
            type=node_data["type"],
            language=node_data["language"],
            file_path=node_data["file_path"],
            line_start=node_data["line_start"],
            line_end=node_data["line_end"],
            code_hash=node_data["code_hash"],
            parent_id=node_data["parent_id"],
            metadata_json=node_data["metadata"],
        )
        session.add(node)

    # Store edges
    for edge_data in graph["edges"]:
        edge = Edge(
            project_id=project_id,
            source_id=edge_data["source_id"],
            target_id=edge_data["target_id"],
            type=edge_data["type"],
            metadata_json=edge_data["metadata"],
        )
        session.add(edge)

    await session.commit()

    if graph["errors"]:
        warnings.append(f"{len(graph['errors'])} file(s) had parse errors")

    return ProjectResponse(
        id=project_id,
        name=name,
        path=project_path,
        github_url=github_url,
        created_at=now.isoformat(),
        last_synced=now.isoformat(),
        stats=graph["stats"],
        warnings=warnings if warnings else None,
    )
