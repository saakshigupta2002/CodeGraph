"""FastAPI application factory."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import FRONTEND_URL
from backend.database import init_db
from backend.routers import bookmarks, branches, export, graph, project, settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    logger.info("Initializing database...")
    await init_db()
    logger.info("CodeGraph backend ready")
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="CodeGraph",
        description="A living X-ray of your codebase",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", FRONTEND_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(project.router)
    app.include_router(graph.router)
    app.include_router(branches.router)
    app.include_router(settings.router)
    app.include_router(bookmarks.router)
    app.include_router(export.router)

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()
