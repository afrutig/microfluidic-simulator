import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root for 'solver'

import numpy as np
import pytest
from solver.stokes_rect import poiseuille_l2_error, solve_stokes_poiseuille_rect


def test_poiseuille_analytic_l2_zero():
    sol = solve_stokes_poiseuille_rect(h=1e-3, l=1e-2, mu=1e-3, u_avg=1e-3, nx=32, ny=32)
    err = poiseuille_l2_error(sol)
    assert err < 1e-12


def test_poiseuille_fem_l2_reasonable():
    pytest.importorskip("skfem")
    from solver.stokes_fem import solve_rect_stokes_fem

    h = 1e-3
    length = 1e-2
    mu = 1e-3
    u_avg = 1e-3
    nx, ny = 40, 12

    m, pdata = solve_rect_stokes_fem(h=h, l=length, mu=mu, u_avg=u_avg, nx=nx, ny=ny)

    # Extract nodes near midline x=l/2
    pts = m.points  # (n,3)
    x = pts[:, 0]
    y = pts[:, 1]
    u = pdata["u"][:, 0]
    # Select nodes nearest to midline
    k = max(10, ny // 2)
    idx = np.argsort(np.abs(x - length / 2))[:k]
    y_mid = y[idx]
    u_mid = u[idx]
    order = np.argsort(y_mid)
    y_mid = y_mid[order]
    u_mid = u_mid[order]

    # Reference profile
    u_ref = 6.0 * u_avg * (y_mid / h) * (1.0 - y_mid / h)
    # L2 relative error on midline
    err = np.sqrt(np.trapz((u_mid - u_ref) ** 2, y_mid) / np.trapz(u_ref**2, y_mid))
    assert err < 0.15, f"FEM Poiseuille L2 error too high: {err}"


def test_poiseuille_mass_balance_analytic():
    from solver.stokes_rect import solve_stokes_poiseuille_rect

    h = 2.0e-3
    length = 1.0e-2
    mu = 1e-3
    u_avg = 2e-3
    sol = solve_stokes_poiseuille_rect(h=h, l=length, mu=mu, u_avg=u_avg, nx=16, ny=200)
    # Integrate u(y) over height
    u_mid = sol.u[:, sol.u.shape[1] // 2]
    q = np.trapz(u_mid, sol.y)  # per unit depth
    assert abs(q - u_avg * h) / (u_avg * h) < 1e-4


def test_poiseuille_fem_mass_balance_ok():
    pytest.importorskip("skfem")
    from solver.stokes_fem import solve_rect_stokes_fem

    h = 1e-3
    length = 1e-2
    mu = 1e-3
    u_avg = 1e-3
    nx, ny = 40, 12
    m, pdata = solve_rect_stokes_fem(h=h, l=length, mu=mu, u_avg=u_avg, nx=nx, ny=ny)
    pts = m.points
    x = pts[:, 0]
    y = pts[:, 1]
    u = pdata["u"][:, 0]
    # Select nodes nearest outlet x=length
    k = max(10, ny)
    idx = np.argsort(np.abs(x - length))[:k]
    y_out = y[idx]
    u_out = u[idx]
    order = np.argsort(y_out)
    y_out = y_out[order]
    u_out = u_out[order]
    q = np.trapz(u_out, y_out)
    rel_err = abs(q - u_avg * h) / (u_avg * h)
    assert rel_err < 0.3, f"Mass balance too poor: rel_err={rel_err}"
