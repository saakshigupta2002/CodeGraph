"""Application configuration and defaults."""

import os
from pathlib import Path

# Paths
DATA_DIR = Path(os.environ.get("CODEGRAPH_DATA_DIR", Path.home() / ".codegraph"))
DB_PATH = DATA_DIR / "codegraph.db"
PROJECTS_DIR = DATA_DIR / "projects"
UPLOAD_DIR = DATA_DIR / "uploads"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Server
HOST = "127.0.0.1"
PORT = 8000
FRONTEND_PORT = 5173
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"

# Analysis defaults
DEFAULT_EXCLUDE_PATTERNS = [
    "node_modules", "__pycache__", ".git", "venv", ".venv", "env",
    "dist", "build", ".idea", ".vscode", ".DS_Store",
    "*.pyc", "*.pyo", "*.so", "*.dylib", "*.dll",
    "*.min.js", "*.min.css", "*.map",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Cargo.lock", "go.sum", "Gemfile.lock", "composer.lock",
]
MAX_FILES_WARNING = 500
MAX_LINES_WARNING = 100_000

# Language support
SUPPORTED_EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hh": "cpp",
    ".rb": "ruby",
    ".php": "php",
}

# AI defaults
DEFAULT_AI_MODEL = "gpt-4o-mini"

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"
