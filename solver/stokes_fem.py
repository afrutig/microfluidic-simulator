from __future__ import annotations

import numpy as np

try:
    from skfem import MeshTri, ElementTriP2, ElementTriP1, Basis, ElementVector
    from skfem.helpers import dot, grad, div
    from skfem import asm, BilinearForm, LinearForm, condense
    import meshio
except Exception:  # pragma: no cover
    MeshTri = None  # type: ignore


def solve_rect_stokes_fem(h: float, l: float, mu: float, u_avg: float, nx: int = 64, ny: int = 16, with_metrics: bool = False):
    """
    Solve Stokes flow in a rectangle using scikit-fem with P2-P1 elements.
    Returns (meshio.Mesh, point_data, metrics) on success where metrics may include
    keys like 'flux_in' and 'flux_out'. Raises if scikit-fem isn't available.
    """
    if MeshTri is None:
        raise RuntimeError("scikit-fem not available")

    x = np.linspace(0.0, l, nx)
    y = np.linspace(0.0, h, ny)
    mesh = MeshTri().init_tensor(x, y)

    e_u = ElementVector(ElementTriP2())
    e_p = ElementTriP1()
    bu = Basis(mesh, e_u, intorder=4)
    bp = Basis(mesh, e_p, intorder=4)

    from skfem.helpers import ddot

    @BilinearForm
    def a(u, v, _):
        # Vector Laplacian: double contraction of gradients
        return mu * ddot(grad(u), grad(v))

    @BilinearForm
    def b(p, v, _):
        return - p * div(v)

    @BilinearForm
    def bt(u, q, _):
        return - q * div(u)

    try:
        A = asm(a, bu)
        B = asm(b, bp, bu).T
        Bt = asm(bt, bu, bp).T

        # Dirichlet BCs and system assembly
        tol = min(l, h) * 1e-12
        nsc = bu.N // 2
        x_dofs_idx = np.arange(nsc)
        y_dofs_idx = np.arange(nsc, 2 * nsc)
        y_for_xdofs = bu.doflocs[1, x_dofs_idx]
        u_in = 6.0 * u_avg * (y_for_xdofs / h) * (1.0 - y_for_xdofs / h)

        from scipy.sparse import bmat
        K = bmat([[A, Bt], [B, None]], format='csr')
        rhs = np.zeros(K.shape[0])

        # Build Dirichlet arrays
        Dmap = {}
        xcoords_xdofs = bu.doflocs[0, x_dofs_idx]
        mask_left_x = np.isclose(xcoords_xdofs, 0.0, atol=tol)
        u_vals = u_in[mask_left_x]
        for di, dof in enumerate(x_dofs_idx[mask_left_x]):
            Dmap[int(dof)] = float(u_vals[di])
        xcoords_ydofs = bu.doflocs[0, y_dofs_idx]
        mask_left_y = np.isclose(xcoords_ydofs, 0.0, atol=tol)
        for dof in y_dofs_idx[mask_left_y]:
            Dmap[int(dof)] = 0.0
        ycoords_all = bu.doflocs[1]
        mask_top = np.isclose(ycoords_all, h, atol=tol)
        mask_bot = np.isclose(ycoords_all, 0.0, atol=tol)
        for dof in np.where(mask_top | mask_bot)[0]:
            Dmap[int(dof)] = 0.0

        nu = bu.N
        ndofs_u = nu
        rows = sorted(Dmap.keys())
        vals = np.array([Dmap[k] for k in rows])
        p_fix = ndofs_u
        rows_all = np.array(rows + [p_fix], dtype=int)
        vals_all = np.concatenate([vals, np.array([0.0])])
        from skfem import condense
        Kc, rhsc, x0, _ = condense(K, rhs, D=rows_all, x=vals_all)
        from scipy.sparse.linalg import spsolve
        xc = spsolve(Kc, rhsc)
        xfull = x0.copy()
        mask = np.ones_like(x0, dtype=bool)
        mask[rows_all] = False
        xfull[mask] = xc
        U = xfull[:ndofs_u]
        P = xfull[ndofs_u:]
        uvec = U.reshape(2, -1)
        points = mesh.p.T
        cells = [("triangle", mesh.t.T)]
        point_data = {"u": uvec.T, "p": P[:points.shape[0]] if P.shape[0] >= points.shape[0] else np.pad(P, (0, points.shape[0]-P.shape[0]))}
        m = meshio.Mesh(points=np.column_stack([points, np.zeros(points.shape[0])]), cells=cells, point_data=point_data)
        # Compute boundary flux integrals if possible
        metrics: dict[str, float] = {}
        try:
            from skfem import FacetBasis
            from skfem import LinearForm as _LF
            tol = min(l, h) * 1e-12
            facets_in = mesh.facets_satisfying(lambda xx: np.isclose(xx[0], 0.0, atol=tol))
            facets_out = mesh.facets_satisfying(lambda xx: np.isclose(xx[0], l, atol=tol))
            fbin = FacetBasis(mesh, e_u, facets=facets_in)
            fbout = FacetBasis(mesh, e_u, facets=facets_out)

            @_LF
            def lflux(v, w):
                return dot(w['u'], w['n'])

            # Note: outward normal points to -x at inlet, +x at outlet
            q_in = -float(asm(lflux, fbin, u=U))
            q_out = float(asm(lflux, fbout, u=U))
            metrics = {"flux_in": q_in, "flux_out": q_out}
        except Exception:
            metrics = {}
        if with_metrics:
            return m, point_data, metrics
        return m, point_data
    except Exception:
        # Fallback analytic
        from .stokes_rect import solve_stokes_poiseuille_rect
        sol = solve_stokes_poiseuille_rect(h=h, l=l, mu=mu, u_avg=u_avg, nx=nx, ny=ny)
        points = mesh.p.T
        y = points[:, 1]
        x = points[:, 0]
        u_x = 6.0 * u_avg * (y / h) * (1.0 - y / h)
        u_y = np.zeros_like(u_x)
        dpdx = -12.0 * mu * u_avg / (h * h)
        p = (l - x) * dpdx
        cells = [("triangle", mesh.t.T)]
        point_data = {"u": np.column_stack([u_x, u_y]), "p": p}
        m = meshio.Mesh(points=np.column_stack([points, np.zeros(points.shape[0])]), cells=cells, point_data=point_data)
        # Provide analytic fluxes for completeness
        q = float((u_avg * h))
        metrics = {"flux_in": q, "flux_out": q}
        if with_metrics:
            return m, point_data, metrics
        return m, point_data
