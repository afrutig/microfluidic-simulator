from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class GeometrySpec(BaseModel):
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class MaterialSpec(BaseModel):
    density: float = Field(gt=0)
    viscosity: float = Field(gt=0)
    diffusivity: float = Field(gt=0)


class BoundarySpec(BaseModel):
    type: str  # inlet | outlet | wall
    value: Optional[float] = None


class JobSpec(BaseModel):
    name: str
    geometry: GeometrySpec
    material: MaterialSpec
    boundaries: list[BoundarySpec]
    solve_transport: bool = True
    geometry_json: Optional[dict] = None


class JobStatus(BaseModel):
    id: str
    status: str
    progress: Optional[float] = None
    error: Optional[str] = None
