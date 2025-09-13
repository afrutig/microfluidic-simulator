from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


def _projects_dir() -> Path:
    artifacts = Path(os.getenv("ARTIFACTS_DIR", "data/artifacts"))
    d = Path(os.getenv("PROJECTS_DIR", artifacts / "projects"))
    d.mkdir(parents=True, exist_ok=True)
    return d


class Project(BaseModel):
    id: str
    name: str
    data: dict = Field(default_factory=dict)


class ProjectCreate(BaseModel):
    name: str
    data: dict


@router.get("/projects")
def list_projects() -> list[Project]:
    base = _projects_dir()
    items: list[Project] = []
    for p in base.glob("*.json"):
        try:
            obj = json.loads(p.read_text())
            items.append(Project(id=p.stem, name=obj.get("name", p.stem), data=obj.get("data", {})))
        except Exception:
            continue
    return items


@router.post("/projects", response_model=Project)
def create_project(payload: ProjectCreate) -> Project:
    base = _projects_dir()
    import uuid

    pid = str(uuid.uuid4())
    content = {"name": payload.name, "data": payload.data}
    (base / f"{pid}.json").write_text(json.dumps(content, indent=2))
    return Project(id=pid, name=payload.name, data=payload.data)


@router.get("/projects/{pid}", response_model=Project)
def get_project(pid: str):
    base = _projects_dir()
    path = base / f"{pid}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    obj = json.loads(path.read_text())
    return Project(id=pid, name=obj.get("name", pid), data=obj.get("data", {}))


@router.put("/projects/{pid}", response_model=Project)
def update_project(pid: str, payload: ProjectCreate):
    base = _projects_dir()
    path = base / f"{pid}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    content = {"name": payload.name, "data": payload.data}
    path.write_text(json.dumps(content, indent=2))
    return Project(id=pid, name=payload.name, data=payload.data)


@router.delete("/projects/{pid}")
def delete_project(pid: str):
    base = _projects_dir()
    path = base / f"{pid}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    path.unlink()
    return {"ok": True}
