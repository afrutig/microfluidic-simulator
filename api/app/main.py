from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import health, imports, jobs, projects, sweeps


def create_app() -> FastAPI:
    app = FastAPI(title="Microfluidic API", version="0.0.1")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])
    app.include_router(imports.router, prefix="/api/v1", tags=["import"])
    app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
    app.include_router(sweeps.router, prefix="/api/v1", tags=["sweeps"])

    return app


app = create_app()
