from __future__ import annotations

import numpy as np
from dataclasses import dataclass


@dataclass
class StokesResult:
    x: np.ndarray  # coordinates (N,)
    y: np.ndarray  # coordinates (M,)
    u: np.ndarray  # x-velocity on grid (M,N)
    v: np.ndarray  # y-velocity on grid (M,N)
    p: np.ndarray  # pressure on grid (M,N)
    h: float
    l: float
    u_avg: float


def solve_stokes_poiseuille_rect(h: float, l: float, mu: float, u_avg: float, nx: int = 64, ny: int = 16) -> StokesResult:
    """
    Solve steady laminar Stokes flow in a 2D rectangular channel with height h (y in [0,h])
    and length l (x in [0,l]). Boundary conditions:
    - Inlet (x=0): parabolic velocity profile with average velocity u_avg
    - Outlet (x=l): zero pressure (reference)
    - Walls (y=0,h): no-slip

    This function returns an analytical Poiseuille solution as a reference field to keep
    runtime tiny; a full FEM solve will be added later for general geometry.
    """
    x = np.linspace(0.0, l, nx)
    y = np.linspace(0.0, h, ny)
    X, Y = np.meshgrid(x, y)
    # Parabolic profile: u(y) = 6 * u_avg * (y/h) * (1 - y/h)
    yy = Y
    u = 6.0 * u_avg * (yy / h) * (1.0 - yy / h)
    v = np.zeros_like(u)
    # Pressure gradient for Poiseuille: dp/dx = -12 * mu * u_avg / h^2
    dpdx = -12.0 * mu * u_avg / (h * h)
    p = (l - X) * dpdx  # p=0 at outlet x=l
    return StokesResult(x=x, y=y, u=u, v=v, p=p, h=h, l=l, u_avg=u_avg)


def poiseuille_l2_error(result: StokesResult) -> float:
    """Compute L2 error of u compared to analytical Poiseuille profile along x midline."""
    h = result.h
    u_avg = result.u_avg
    y = result.y
    u_ref = 6.0 * u_avg * (y / h) * (1.0 - y / h)
    # take numerical u at middle column
    mid = result.u[:, result.u.shape[1] // 2]
    err = np.sqrt(np.trapz((mid - u_ref) ** 2, y) / np.trapz(u_ref ** 2, y))
    return float(err)

