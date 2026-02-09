"""Build dependency graph from parsed AST data."""

import json
import logging
from pathlib import Path

from backend.analysis.parser import FileParseResult, parse_file
from backend.utils import collect_files, generate_id, get_language

logger = logging.getLogger(__name__)


def build_graph(project_path: str, exclude_patterns: list[str] | None = None) -> dict:
    """Parse all files and build the full dependency graph.

    Returns dict with keys: nodes, edges, stats, errors
    """
    files = collect_files(project_path, exclude_patterns)

    all_nodes = []
    all_edges = []
    errors = []

    # Parse all files
    parse_results: list[FileParseResult] = []
    for f in files:
        language = get_language(str(f))
        result = parse_file(str(f), project_path, language)
        parse_results.append(result)
        if result.errors:
            errors.extend([f"{result.file_path}: {e}" for e in result.errors])

    # Build lookup for resolving call edges
    func_name_to_ids: dict[str, list[str]] = {}  # name -> list of node IDs
    class_name_to_id: dict[str, str] = {}
    file_to_node_id: dict[str, str] = {}

    # Phase 1: Create all nodes
    for result in parse_results:
        # File node — use relative path (consistent with class/function nodes)
        rel_path = str(Path(result.file_path).relative_to(project_path))
        file_node_id = generate_id()
        file_to_node_id[rel_path] = file_node_id
        all_nodes.append({
            "id": file_node_id,
            "name": Path(result.file_path).name,
            "type": "file",
            "language": result.language,
            "file_path": rel_path,
            "line_start": None,
            "line_end": None,
            "code_hash": None,
            "parent_id": None,
            "metadata": json.dumps({"full_path": result.file_path}),
        })

        # Class nodes
        for cls in result.classes:
            cls_id = generate_id()
            class_name_to_id[f"{result.file_path}:{cls.name}"] = cls_id
            class_name_to_id[cls.name] = cls_id  # Also index by simple name
            all_nodes.append({
                "id": cls_id,
                "name": cls.name,
                "type": "class",
                "language": cls.language,
                "file_path": cls.file_path,
                "line_start": cls.line_start,
                "line_end": cls.line_end,
                "code_hash": cls.code_hash,
                "parent_id": file_node_id,
                "metadata": json.dumps({
                    "methods": cls.methods,
                    "superclasses": cls.superclasses,
                    "method_count": len(cls.methods),
                    "attributes": cls.attributes,
                }),
            })

        # Function nodes
        for func in result.functions:
            func_id = generate_id()
            parent = None
            if func.parent_class:
                parent = class_name_to_id.get(f"{result.file_path}:{func.parent_class}")
                if not parent:
                    parent = class_name_to_id.get(func.parent_class)
            if not parent:
                parent = file_node_id

            full_name = f"{func.parent_class}.{func.name}" if func.parent_class else func.name
            key = f"{result.file_path}:{full_name}"
            func_name_to_ids.setdefault(func.name, []).append(func_id)
            func_name_to_ids.setdefault(full_name, []).append(func_id)
            func_name_to_ids.setdefault(key, []).append(func_id)

            all_nodes.append({
                "id": func_id,
                "name": func.name,
                "type": "function",
                "language": func.language,
                "file_path": func.file_path,
                "line_start": func.line_start,
                "line_end": func.line_end,
                "code_hash": func.code_hash,
                "parent_id": parent,
                "metadata": json.dumps({
                    "params": func.params,
                    "calls": func.calls,
                    "parent_class": func.parent_class,
                    "full_name": full_name,
                }),
            })

        # Variable nodes
        for var in result.variables:
            var_id = generate_id()
            all_nodes.append({
                "id": var_id,
                "name": var.name,
                "type": "variable",
                "language": var.language,
                "file_path": var.file_path,
                "line_start": var.line_start,
                "line_end": var.line_end,
                "code_hash": var.code_hash,
                "parent_id": file_node_id,
                "metadata": json.dumps({"scope": var.scope}),
            })

        # Import nodes
        for imp in result.imports:
            imp_id = generate_id()
            all_nodes.append({
                "id": imp_id,
                "name": imp.name,
                "type": "import",
                "language": imp.language,
                "file_path": imp.file_path,
                "line_start": imp.line_start,
                "line_end": imp.line_end,
                "code_hash": None,
                "parent_id": file_node_id,
                "metadata": json.dumps({
                    "source": imp.source,
                    "is_external": imp.is_external,
                }),
            })

    # Phase 2: Build edges
    node_by_id = {n["id"]: n for n in all_nodes}

    # Call edges: function → called function
    for node in all_nodes:
        if node["type"] != "function":
            continue
        meta = json.loads(node["metadata"]) if node["metadata"] else {}
        calls = meta.get("calls", [])
        for call_name in calls:
            targets = func_name_to_ids.get(call_name, [])
            for target_id in targets:
                if target_id != node["id"]:  # No self-loops
                    all_edges.append({
                        "source_id": node["id"],
                        "target_id": target_id,
                        "type": "calls",
                        "metadata": json.dumps({"call_name": call_name}),
                    })

    # Inheritance edges: subclass → superclass
    for node in all_nodes:
        if node["type"] != "class":
            continue
        meta = json.loads(node["metadata"]) if node["metadata"] else {}
        for superclass in meta.get("superclasses", []):
            parent_id = class_name_to_id.get(superclass)
            if parent_id:
                all_edges.append({
                    "source_id": node["id"],
                    "target_id": parent_id,
                    "type": "inherits",
                    "metadata": None,
                })

    # Import edges: file → imported module/file
    for node in all_nodes:
        if node["type"] != "import":
            continue
        meta = json.loads(node["metadata"]) if node["metadata"] else {}
        source_mod = meta.get("source", "")
        source_file_node = file_to_node_id.get(node["file_path"])

        # Try to resolve import to a project file
        target_file = _resolve_import(source_mod, node.get("language", ""), project_path)
        if target_file and target_file in file_to_node_id:
            all_edges.append({
                "source_id": source_file_node,
                "target_id": file_to_node_id[target_file],
                "type": "imports",
                "metadata": json.dumps({
                    "source": source_mod,
                    "is_external": meta.get("is_external", False),
                }),
            })

    # Compute stats
    stats = _compute_stats(all_nodes, all_edges, files)

    return {
        "nodes": all_nodes,
        "edges": all_edges,
        "stats": stats,
        "errors": errors,
    }


def _resolve_import(source: str, language: str, project_path: str) -> str | None:
    """Try to resolve an import source to a relative file path in the project."""
    if not source:
        return None

    root = Path(project_path)

    if language == "python":
        # Convert dot notation to path
        parts = source.lstrip(".").split(".")
        candidates = [
            "/".join(parts) + ".py",
            "/".join(parts) + "/__init__.py",
        ]
        for c in candidates:
            if (root / c).exists():
                return c
    elif language in ("javascript", "typescript"):
        if source.startswith("."):
            candidates = [
                source + ".js", source + ".ts", source + ".tsx", source + ".jsx",
                source + "/index.js", source + "/index.ts",
            ]
            for c in candidates:
                normalized = str(Path(c))
                if (root / normalized).exists():
                    return normalized
    elif language == "java":
        # Convert package path
        parts = source.replace(".", "/")
        candidate = parts + ".java"
        if (root / candidate).exists():
            return candidate

    return None


def _compute_stats(nodes: list[dict], edges: list[dict], files: list[Path]) -> dict:
    """Compute project overview statistics."""
    file_count = len(files)
    function_count = sum(1 for n in nodes if n["type"] == "function")
    class_count = sum(1 for n in nodes if n["type"] == "class")
    variable_count = sum(1 for n in nodes if n["type"] == "variable")
    import_count = sum(1 for n in nodes if n["type"] == "import")

    # Detect test files
    test_files = [n for n in nodes if n["type"] == "file" and _is_test_file(n["file_path"])]
    test_file_count = len(test_files)

    # Simple coverage estimate based on test file existence
    testable_functions = [n for n in nodes if n["type"] == "function" and not _is_test_file(n["file_path"])]
    test_functions = [n for n in nodes if n["type"] == "function" and _is_test_file(n["file_path"])]

    # Build simple coverage mapping: test functions that call production functions
    tested_functions = set()
    for tf in test_functions:
        meta = json.loads(tf["metadata"]) if tf["metadata"] else {}
        for call in meta.get("calls", []):
            tested_functions.add(call)

    coverage = 0
    if testable_functions:
        covered = sum(1 for f in testable_functions if f["name"] in tested_functions)
        coverage = round(covered / len(testable_functions) * 100)

    return {
        "file_count": file_count,
        "function_count": function_count,
        "class_count": class_count,
        "variable_count": variable_count,
        "import_count": import_count,
        "test_file_count": test_file_count,
        "coverage_percent": coverage,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


def _is_test_file(path: str) -> bool:
    """Check if a file path looks like a test file."""
    name = Path(path).stem.lower()
    parts = Path(path).parts
    return (
        name.startswith("test_") or
        name.endswith("_test") or
        name.startswith("test") and name != "test" or
        name.endswith("_spec") or
        name.endswith(".test") or
        name.endswith(".spec") or
        "tests" in parts or
        "test" in parts or
        "__tests__" in parts or
        "spec" in parts
    )
