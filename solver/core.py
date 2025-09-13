"""Minimal solver stub.

This module exposes a function interface that the API workers can call.
Replace with real numerics (FEM/FVM) in future iterations.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SolveResult:
    ok: bool
    mesh_cells: int
    fields: list[str]


def steady_flow_and_transport(mesh_cells: int = 10_000) -> SolveResult:
    # Placeholder: pretend we solved something useful
    return SolveResult(ok=True, mesh_cells=mesh_cells, fields=["u", "v", "p", "c"])

