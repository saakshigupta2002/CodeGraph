"""Incremental update engine: git diff → selective re-parse → patch graph."""

import json
import logging
import subprocess
from pathlib import Path

from backend.analysis.graph_builder import build_graph
from backend.analysis.parser import parse_file
from backend.utils import get_language, is_excluded, is_supported_file

logger = logging.getLogger(__name__)


def get_changed_files(project_path: str) -> dict:
    """Run git diff to find changed files since last commit/sync.

    Returns dict with keys: added, modified, deleted
    """
    result = {"added": [], "modified": [], "deleted": []}

    try:
        # Get staged + unstaged changes
        proc = subprocess.run(
            ["git", "diff", "--name-status", "HEAD"],
            cwd=project_path,
            capture_output=True, text=True, timeout=30,
        )
        if proc.returncode != 0:
            # Try without HEAD (initial commit case)
            proc = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=project_path,
                capture_output=True, text=True, timeout=30,
            )
            if proc.returncode == 0:
                for line in proc.stdout.strip().split("\n"):
                    if not line.strip():
                        continue
                    status = line[:2].strip()
                    path = line[3:].strip()
                    if status in ("?", "??", "A"):
                        result["added"].append(path)
                    elif status == "M":
                        result["modified"].append(path)
                    elif status == "D":
                        result["deleted"].append(path)
            return result

        for line in proc.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            status, path = parts[0], parts[1]
            if status.startswith("A"):
                result["added"].append(path)
            elif status.startswith("M"):
                result["modified"].append(path)
            elif status.startswith("D"):
                result["deleted"].append(path)
            elif status.startswith("R"):
                # Rename: old path deleted, new path added
                result["deleted"].append(path)
                if len(parts) > 2:
                    result["added"].append(parts[2])

        # Also check untracked files
        proc2 = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard"],
            cwd=project_path,
            capture_output=True, text=True, timeout=30,
        )
        if proc2.returncode == 0:
            for line in proc2.stdout.strip().split("\n"):
                if line.strip() and line.strip() not in result["added"]:
                    result["added"].append(line.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        logger.warning(f"Git diff failed: {e}")

    return result


def compute_incremental_update(
    project_path: str,
    existing_nodes: list[dict],
    existing_edges: list[dict],
    exclude_patterns: list[str] | None = None,
) -> dict:
    """Compute incremental graph update based on git diff.

    Returns dict with: changed_files, nodes_added, nodes_removed, nodes_modified,
                       edges_added, edges_removed, broken_references, invalidated_caches
    """
    changes = get_changed_files(project_path)

    # Filter to supported files only
    for key in ("added", "modified", "deleted"):
        changes[key] = [
            f for f in changes[key]
            if is_supported_file(f) and not is_excluded(Path(f), exclude_patterns)
        ]

    all_changed = set(changes["added"] + changes["modified"] + changes["deleted"])

    if not all_changed:
        return {
            "changed_files": changes,
            "needs_full_rebuild": False,
            "summary": "No changes detected",
        }

    # For simplicity in v1, if changes affect more than 30% of files, do full rebuild
    existing_files = set(n["file_path"] for n in existing_nodes if n["type"] == "file")
    change_ratio = len(all_changed) / max(len(existing_files), 1)

    if change_ratio > 0.3:
        return {
            "changed_files": changes,
            "needs_full_rebuild": True,
            "summary": f"Large change set ({len(all_changed)} files) — full rebuild recommended",
        }

    # Identify broken references from deleted files
    deleted_node_ids = set()
    broken_references = []

    for node in existing_nodes:
        if node["file_path"] in changes["deleted"]:
            deleted_node_ids.add(node["id"])

    for edge in existing_edges:
        if edge["target_id"] in deleted_node_ids:
            source_node = next((n for n in existing_nodes if n["id"] == edge["source_id"]), None)
            target_node = next((n for n in existing_nodes if n["id"] == edge["target_id"]), None)
            if source_node and target_node:
                broken_references.append({
                    "source": source_node["name"],
                    "source_file": source_node["file_path"],
                    "target": target_node["name"],
                    "target_file": target_node["file_path"],
                    "edge_type": edge["type"],
                })

    # Identify caches to invalidate (modified files)
    invalidated_caches = []
    for node in existing_nodes:
        if node["file_path"] in changes["modified"] and node["type"] == "function":
            invalidated_caches.append(node["id"])

    summary_parts = []
    if changes["added"]:
        summary_parts.append(f"{len(changes['added'])} added")
    if changes["modified"]:
        summary_parts.append(f"{len(changes['modified'])} modified")
    if changes["deleted"]:
        summary_parts.append(f"{len(changes['deleted'])} deleted")
    if broken_references:
        summary_parts.append(f"{len(broken_references)} broken reference(s)")

    return {
        "changed_files": changes,
        "needs_full_rebuild": True,  # v1: always rebuild on changes for correctness
        "broken_references": broken_references,
        "invalidated_caches": invalidated_caches,
        "summary": "Synced: " + ", ".join(summary_parts) if summary_parts else "No changes",
    }


def get_branches(project_path: str) -> list[dict]:
    """List local git branches."""
    branches = []
    try:
        proc = subprocess.run(
            ["git", "branch", "--format=%(refname:short) %(HEAD)"],
            cwd=project_path,
            capture_output=True, text=True, timeout=10,
        )
        if proc.returncode == 0:
            for line in proc.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                parts = line.strip().split()
                name = parts[0]
                is_current = len(parts) > 1 and parts[1] == "*"
                branches.append({"name": name, "current": is_current})
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        logger.warning(f"Git branch listing failed: {e}")

    return branches


def switch_branch(project_path: str, branch_name: str) -> dict:
    """Switch to a different git branch."""
    try:
        proc = subprocess.run(
            ["git", "checkout", branch_name],
            cwd=project_path,
            capture_output=True, text=True, timeout=30,
        )
        if proc.returncode == 0:
            return {"success": True, "message": f"Switched to {branch_name}"}
        return {"success": False, "message": proc.stderr.strip()}
    except Exception as e:
        return {"success": False, "message": str(e)}


def compare_branches(project_path: str, branch_a: str, branch_b: str) -> dict:
    """Compare two branches and return diff summary."""
    try:
        proc = subprocess.run(
            ["git", "diff", "--name-status", f"{branch_a}...{branch_b}"],
            cwd=project_path,
            capture_output=True, text=True, timeout=30,
        )
        if proc.returncode != 0:
            return {"error": proc.stderr.strip()}

        added, removed, modified = [], [], []
        for line in proc.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            status, path = parts[0], parts[1]
            if status.startswith("A"):
                added.append(path)
            elif status.startswith("D"):
                removed.append(path)
            elif status.startswith("M"):
                modified.append(path)

        return {
            "branch_a": branch_a,
            "branch_b": branch_b,
            "added": added,
            "removed": removed,
            "modified": modified,
            "summary": f"Comparing {branch_a} → {branch_b}: {len(added)} added, {len(removed)} removed, {len(modified)} modified",
        }
    except Exception as e:
        return {"error": str(e)}
