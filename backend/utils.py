"""Shared utility functions."""

import fnmatch
import hashlib
import uuid
from pathlib import Path

from backend.config import DEFAULT_EXCLUDE_PATTERNS, SUPPORTED_EXTENSIONS


def generate_id() -> str:
    return uuid.uuid4().hex[:16]


def hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()[:16]


def is_excluded(path: Path, exclude_patterns: list[str] | None = None) -> bool:
    patterns = exclude_patterns or DEFAULT_EXCLUDE_PATTERNS
    parts = path.parts
    for pattern in patterns:
        for part in parts:
            if fnmatch.fnmatch(part, pattern):
                return True
        if fnmatch.fnmatch(str(path), pattern):
            return True
    return False


def get_language(file_path: str) -> str | None:
    ext = Path(file_path).suffix.lower()
    return SUPPORTED_EXTENSIONS.get(ext)


def is_supported_file(file_path: str) -> bool:
    return get_language(file_path) is not None


def collect_files(project_path: str, exclude_patterns: list[str] | None = None) -> list[Path]:
    """Collect all supported source files from a project directory."""
    root = Path(project_path)
    files = []
    for f in root.rglob("*"):
        if f.is_file() and not is_excluded(f.relative_to(root), exclude_patterns) and is_supported_file(str(f)):
            files.append(f)
    return sorted(files)


def build_file_tree(project_path: str, exclude_patterns: list[str] | None = None) -> dict:
    """Build a hierarchical file tree structure with metadata."""
    root = Path(project_path)
    tree = {"name": root.name, "path": "", "type": "directory", "children": []}

    for item in sorted(root.iterdir()):
        rel = item.relative_to(root)
        if is_excluded(rel, exclude_patterns):
            continue
        if item.is_dir():
            subtree = _build_subtree(item, root, exclude_patterns)
            if subtree["children"] or subtree.get("has_supported"):
                tree["children"].append(subtree)
        elif item.is_file():
            lang = get_language(str(item))
            tree["children"].append({
                "name": item.name,
                "path": str(rel),
                "type": "file",
                "language": lang,
                "supported": lang is not None,
            })
    return tree


def _build_subtree(directory: Path, root: Path, exclude_patterns: list[str] | None) -> dict:
    rel = directory.relative_to(root)
    node = {"name": directory.name, "path": str(rel), "type": "directory", "children": [], "has_supported": False}

    for item in sorted(directory.iterdir()):
        item_rel = item.relative_to(root)
        if is_excluded(item_rel, exclude_patterns):
            continue
        if item.is_dir():
            subtree = _build_subtree(item, root, exclude_patterns)
            if subtree["children"] or subtree.get("has_supported"):
                node["children"].append(subtree)
                node["has_supported"] = True
        elif item.is_file():
            lang = get_language(str(item))
            node["children"].append({
                "name": item.name,
                "path": str(item_rel),
                "type": "file",
                "language": lang,
                "supported": lang is not None,
            })
            if lang is not None:
                node["has_supported"] = True
    return node
