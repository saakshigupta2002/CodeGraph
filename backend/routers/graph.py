"""Graph data, node detail, search, and impact analysis endpoints."""

import json
from collections import deque
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.ai.openai_provider import OpenAIProvider
from backend.database import get_session
from backend.models import AICache, Edge, Node, Project, Setting

router = APIRouter(prefix="/api/project", tags=["graph"])


class SearchRequest(BaseModel):
    query: str


class ImpactRequest(BaseModel):
    node_ids: list[str]


class FileAnalyzeRequest(BaseModel):
    file_path: str


@router.get("/{project_id}/graph")
async def get_graph(
    project_id: str,
    tab: str | None = Query(None, description="Filter: classes|functions|variables|tests|imports"),
    session: AsyncSession = Depends(get_session),
):
    """Return full or filtered graph data (nodes + edges)."""
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    nodes_result = await session.execute(select(Node).where(Node.project_id == project_id))
    edges_result = await session.execute(select(Edge).where(Edge.project_id == project_id))

    all_nodes = nodes_result.scalars().all()
    all_edges = edges_result.scalars().all()

    # Convert to dicts
    nodes = [_node_to_dict(n) for n in all_nodes]
    edges = [_edge_to_dict(e) for e in all_edges]

    if tab:
        nodes, edges = _filter_by_tab(tab, nodes, edges)

    return {"nodes": nodes, "edges": edges}


@router.get("/{project_id}/node/{node_id}")
async def get_node_detail(project_id: str, node_id: str, session: AsyncSession = Depends(get_session)):
    """Return detailed node info: code snippet, connections, test status."""
    node = await session.get(Node, node_id)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    project = await session.get(Project, project_id)

    # Get code snippet
    code = ""
    if node.line_start and node.line_end and project:
        file_path = Path(project.path) / node.file_path
        if file_path.exists():
            try:
                lines = file_path.read_text(errors="replace").splitlines()
                code = "\n".join(lines[node.line_start - 1:node.line_end])
            except Exception:
                pass

    # Get connections
    edges_out = await session.execute(
        select(Edge).where(Edge.source_id == node_id, Edge.project_id == project_id)
    )
    edges_in = await session.execute(
        select(Edge).where(Edge.target_id == node_id, Edge.project_id == project_id)
    )

    outgoing = edges_out.scalars().all()
    incoming = edges_in.scalars().all()

    # Resolve node names for connections
    connected_ids = set(e.target_id for e in outgoing) | set(e.source_id for e in incoming)
    if connected_ids:
        connected_result = await session.execute(select(Node).where(Node.id.in_(connected_ids)))
        connected_nodes = {n.id: n for n in connected_result.scalars().all()}
    else:
        connected_nodes = {}

    calls = [
        {"id": e.target_id, "name": connected_nodes[e.target_id].name, "type": e.type,
         "file_path": connected_nodes[e.target_id].file_path,
         "line_start": connected_nodes[e.target_id].line_start}
        for e in outgoing if e.target_id in connected_nodes
    ]
    called_by = [
        {"id": e.source_id, "name": connected_nodes[e.source_id].name, "type": e.type,
         "file_path": connected_nodes[e.source_id].file_path,
         "line_start": connected_nodes[e.source_id].line_start}
        for e in incoming if e.source_id in connected_nodes
    ]

    # Check AI cache
    cached = await session.get(AICache, node_id)
    ai_explanation = None
    if cached and cached.code_hash == node.code_hash:
        ai_explanation = cached.explanation

    # Test status
    test_status = _compute_test_status(node, incoming, connected_nodes)

    return {
        "node": _node_to_dict(node),
        "code": code,
        "calls": calls,
        "called_by": called_by,
        "ai_explanation": ai_explanation,
        "test_status": test_status,
    }


@router.post("/{project_id}/node/{node_id}/explain")
async def explain_node(project_id: str, node_id: str, session: AsyncSession = Depends(get_session)):
    """Generate AI explanation for a node (streaming response)."""
    node = await session.get(Node, node_id)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    # Check cache first
    cached = await session.get(AICache, node_id)
    if cached and cached.code_hash == node.code_hash:
        async def cached_stream():
            yield cached.explanation
        return StreamingResponse(cached_stream(), media_type="text/plain")

    # Get API key
    key_setting = await session.execute(select(Setting).where(Setting.key == "openai_api_key"))
    key_row = key_setting.scalar_one_or_none()
    if not key_row:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured. Add it in Settings.")

    # Get model setting
    model_setting = await session.execute(select(Setting).where(Setting.key == "ai_model"))
    model_row = model_setting.scalar_one_or_none()
    model = model_row.value if model_row else "gpt-4o-mini"

    # Get code
    project = await session.get(Project, project_id)
    code = ""
    if node.line_start and node.line_end and project:
        file_path = Path(project.path) / node.file_path
        if file_path.exists():
            try:
                lines = file_path.read_text(errors="replace").splitlines()
                code = "\n".join(lines[node.line_start - 1:node.line_end])
            except Exception:
                pass

    if not code:
        raise HTTPException(status_code=400, detail="Cannot read code for this node")

    # Get connections context
    edges_result = await session.execute(
        select(Edge).where(
            (Edge.source_id == node_id) | (Edge.target_id == node_id),
            Edge.project_id == project_id,
        )
    )
    edges = edges_result.scalars().all()
    connected_ids = set()
    for e in edges:
        connected_ids.add(e.source_id)
        connected_ids.add(e.target_id)
    connected_ids.discard(node_id)

    context = f"File: {node.file_path}, Type: {node.type}"
    if connected_ids:
        conn_result = await session.execute(select(Node).where(Node.id.in_(connected_ids)))
        conn_names = [n.name for n in conn_result.scalars().all()]
        context += f", Connected to: {', '.join(conn_names[:10])}"

    provider = OpenAIProvider(api_key=key_row.value, model=model)

    async def stream_and_cache():
        full_text = []
        async for chunk in provider.explain(code, node.name, context):
            full_text.append(chunk)
            yield chunk

        # Cache the result
        explanation = "".join(full_text)
        async with get_session_direct() as cache_session:
            existing = await cache_session.get(AICache, node_id)
            if existing:
                existing.explanation = explanation
                existing.code_hash = node.code_hash
            else:
                cache_session.add(AICache(
                    node_id=node_id,
                    code_hash=node.code_hash,
                    explanation=explanation,
                ))
            await cache_session.commit()

    return StreamingResponse(stream_and_cache(), media_type="text/plain")


@router.post("/{project_id}/search")
async def search_graph(project_id: str, req: SearchRequest, session: AsyncSession = Depends(get_session)):
    """Search the graph: exact match (free) or AI-powered (uses API key)."""
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Empty query")

    # Exact match search first
    nodes_result = await session.execute(select(Node).where(Node.project_id == project_id))
    all_nodes = nodes_result.scalars().all()

    exact_matches = []
    partial_matches = []
    query_lower = query.lower()

    for node in all_nodes:
        name_lower = node.name.lower()
        if name_lower == query_lower:
            exact_matches.append(_node_to_dict(node))
        elif query_lower in name_lower:
            partial_matches.append(_node_to_dict(node))

    if exact_matches or partial_matches:
        results = exact_matches + partial_matches[:10]
        return {"type": "exact", "results": results[:15]}

    # AI search fallback
    key_setting = await session.execute(select(Setting).where(Setting.key == "openai_api_key"))
    key_row = key_setting.scalar_one_or_none()
    if not key_row:
        return {"type": "no_key", "results": [], "message": "No matches found. Add OpenAI API key for AI-powered search."}

    model_setting = await session.execute(select(Setting).where(Setting.key == "ai_model"))
    model_row = model_setting.scalar_one_or_none()
    model = model_row.value if model_row else "gpt-4o-mini"

    # Send only metadata (names, types, file paths) — never code
    graph_metadata = {
        "nodes": [
            {"name": n.name, "type": n.type, "file_path": n.file_path}
            for n in all_nodes if n.type in ("function", "class", "file")
        ]
    }

    provider = OpenAIProvider(api_key=key_row.value, model=model)
    try:
        ai_results = await provider.search(query, graph_metadata)
        # Match AI results back to actual nodes
        matched = []
        for ai_r in ai_results:
            for node in all_nodes:
                if node.name == ai_r.get("name") and node.file_path == ai_r.get("file_path"):
                    result = _node_to_dict(node)
                    result["reason"] = ai_r.get("reason", "")
                    matched.append(result)
                    break
        return {"type": "ai", "results": matched}
    except Exception as e:
        return {"type": "error", "results": [], "message": str(e)}


@router.post("/{project_id}/impact")
async def analyze_impact(project_id: str, req: ImpactRequest, session: AsyncSession = Depends(get_session)):
    """Compute blast radius for given node(s). Pure graph traversal, no AI."""
    if not req.node_ids:
        raise HTTPException(status_code=400, detail="No nodes specified")

    # Load full graph
    nodes_result = await session.execute(select(Node).where(Node.project_id == project_id))
    edges_result = await session.execute(select(Edge).where(Edge.project_id == project_id))

    all_nodes = {n.id: n for n in nodes_result.scalars().all()}
    all_edges = edges_result.scalars().all()

    # Build adjacency list (reverse: who depends on this node)
    dependents: dict[str, list[str]] = {}  # node_id -> list of IDs that depend on it
    edge_types: dict[tuple[str, str], str] = {}

    for edge in all_edges:
        dependents.setdefault(edge.target_id, []).append(edge.source_id)
        edge_types[(edge.source_id, edge.target_id)] = edge.type

    # BFS from selected nodes
    selected = set(req.node_ids)
    directly_affected = set()
    indirectly_affected = set()
    dependency_chains: dict[str, list[str]] = {}  # node_id -> chain path

    # Level 1: direct dependents
    for node_id in selected:
        for dep_id in dependents.get(node_id, []):
            if dep_id not in selected:
                directly_affected.add(dep_id)
                dependency_chains[dep_id] = [all_nodes[node_id].name if node_id in all_nodes else node_id]

    # BFS for indirect
    queue = deque(directly_affected)
    visited = selected | directly_affected

    while queue:
        current = queue.popleft()
        for dep_id in dependents.get(current, []):
            if dep_id not in visited:
                visited.add(dep_id)
                indirectly_affected.add(dep_id)
                # Build chain
                parent_chain = dependency_chains.get(current, [])
                current_name = all_nodes[current].name if current in all_nodes else current
                dependency_chains[dep_id] = parent_chain + [current_name]
                queue.append(dep_id)

    # Find affected tests
    from backend.analysis.graph_builder import _is_test_file
    tests_affected = set()
    for node_id in directly_affected | indirectly_affected:
        node = all_nodes.get(node_id)
        if node and _is_test_file(node.file_path):
            tests_affected.add(node_id)

    return {
        "selected": [_node_to_dict(all_nodes[nid]) for nid in req.node_ids if nid in all_nodes],
        "directly_affected": [
            {**_node_to_dict(all_nodes[nid]), "chain": dependency_chains.get(nid, [])}
            for nid in directly_affected if nid in all_nodes
        ],
        "indirectly_affected": [
            {**_node_to_dict(all_nodes[nid]), "chain": dependency_chains.get(nid, [])}
            for nid in indirectly_affected if nid in all_nodes
        ],
        "tests_needing_update": [
            _node_to_dict(all_nodes[nid])
            for nid in tests_affected if nid in all_nodes
        ],
        "summary": {
            "directly_affected": len(directly_affected),
            "indirectly_affected": len(indirectly_affected),
            "tests_needing_update": len(tests_affected),
        },
    }


@router.post("/{project_id}/analyze-file")
async def analyze_file(project_id: str, req: FileAnalyzeRequest, session: AsyncSession = Depends(get_session)):
    """Per-file AI analysis (coupling, single points of failure, suggestions)."""
    key_setting = await session.execute(select(Setting).where(Setting.key == "openai_api_key"))
    key_row = key_setting.scalar_one_or_none()
    if not key_row:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    # Get file nodes and edges
    nodes_result = await session.execute(
        select(Node).where(Node.project_id == project_id, Node.file_path == req.file_path)
    )
    file_nodes = nodes_result.scalars().all()
    if not file_nodes:
        raise HTTPException(status_code=404, detail="File not found in project graph")

    node_ids = {n.id for n in file_nodes}

    # Count dependencies
    edges_result = await session.execute(select(Edge).where(Edge.project_id == project_id))
    all_edges = edges_result.scalars().all()

    external_deps = set()
    internal_deps = set()
    dependents = set()
    for edge in all_edges:
        if edge.source_id in node_ids and edge.target_id not in node_ids:
            external_deps.add(edge.target_id)
        if edge.target_id in node_ids and edge.source_id not in node_ids:
            dependents.add(edge.source_id)

    # Get line count
    project = await session.get(Project, project_id)
    line_count = 0
    if project:
        fp = Path(project.path) / req.file_path
        if fp.exists():
            line_count = fp.read_text(errors="replace").count("\n") + 1

    model_setting = await session.execute(select(Setting).where(Setting.key == "ai_model"))
    model_row = model_setting.scalar_one_or_none()
    model = model_row.value if model_row else "gpt-4o-mini"

    provider = OpenAIProvider(api_key=key_row.value, model=model)
    from backend.utils import get_language
    analysis = await provider.analyze_file({
        "file_path": req.file_path,
        "language": get_language(req.file_path),
        "function_count": sum(1 for n in file_nodes if n.type == "function"),
        "class_count": sum(1 for n in file_nodes if n.type == "class"),
        "external_deps": len(external_deps),
        "internal_deps": len(internal_deps),
        "dependents": len(dependents),
        "line_count": line_count,
    })

    return {"file_path": req.file_path, "analysis": analysis}


# --- Helpers ---

def _node_to_dict(node) -> dict:
    if isinstance(node, dict):
        return node
    return {
        "id": node.id,
        "name": node.name,
        "type": node.type,
        "language": node.language,
        "file_path": node.file_path,
        "line_start": node.line_start,
        "line_end": node.line_end,
        "code_hash": node.code_hash,
        "parent_id": node.parent_id,
        "metadata": json.loads(node.metadata_json) if node.metadata_json else {},
    }


def _edge_to_dict(edge) -> dict:
    if isinstance(edge, dict):
        return edge
    return {
        "id": edge.id,
        "source_id": edge.source_id,
        "target_id": edge.target_id,
        "type": edge.type,
        "metadata": json.loads(edge.metadata_json) if edge.metadata_json else {},
    }


def _filter_by_tab(tab: str, nodes: list[dict], edges: list[dict]) -> tuple[list[dict], list[dict]]:
    """Filter nodes and edges based on the selected tab."""
    type_map = {
        "classes": {"class"},
        "functions": {"function"},
        "variables": {"variable"},
        "tests": {"function", "file"},  # Show test functions and files
        "imports": {"import", "file"},
    }

    allowed_types = type_map.get(tab, set())
    if not allowed_types:
        return nodes, edges

    if tab == "tests":
        from backend.analysis.graph_builder import _is_test_file
        filtered_nodes = [n for n in nodes if n["type"] in allowed_types]
        # For tests tab, include test files and the code they test
        test_file_paths = {n["file_path"] for n in filtered_nodes if _is_test_file(n["file_path"])}
        # Also include non-test nodes that are connected to test nodes
        test_node_ids = {n["id"] for n in filtered_nodes if _is_test_file(n["file_path"])}
        connected_ids = set()
        for e in edges:
            if e["source_id"] in test_node_ids:
                connected_ids.add(e["target_id"])
            if e["target_id"] in test_node_ids:
                connected_ids.add(e["source_id"])
        filtered_nodes = [
            n for n in nodes
            if n["id"] in test_node_ids or n["id"] in connected_ids
        ]
    else:
        # Also keep file nodes as parents for context
        filtered_nodes = [n for n in nodes if n["type"] in allowed_types or n["type"] == "file"]

    node_ids = {n["id"] for n in filtered_nodes}

    if tab == "imports":
        edge_types = {"imports"}
    elif tab == "classes":
        edge_types = {"inherits", "composes"}
    elif tab == "functions":
        edge_types = {"calls"}
    elif tab == "variables":
        edge_types = {"reads", "writes", "calls"}
    else:
        edge_types = None

    filtered_edges = [
        e for e in edges
        if e["source_id"] in node_ids and e["target_id"] in node_ids
        and (edge_types is None or e["type"] in edge_types)
    ]

    return filtered_nodes, filtered_edges


def _compute_test_status(node, incoming_edges, connected_nodes) -> dict:
    """Compute test coverage status for a node."""
    from backend.analysis.graph_builder import _is_test_file

    test_files = set()
    for edge in incoming_edges:
        source = connected_nodes.get(edge.source_id)
        if source and _is_test_file(source.file_path):
            test_files.add(source.file_path)

    if test_files:
        return {"status": "covered", "test_files": list(test_files), "coverage": "covered"}
    return {"status": "uncovered", "test_files": [], "coverage": "uncovered"}


async def get_session_direct():
    """Get a direct session (not via Depends)."""
    from backend.database import async_session
    return async_session()
