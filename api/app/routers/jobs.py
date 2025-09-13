import os
import time
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from redis import Redis
from rq import Queue

from ..schemas import JobSpec, JobStatus

router = APIRouter()

# In-memory results for inline (no-queue) mode
_MEM_RESULTS: dict[str, dict] = {}
_MEM_ERRORS: dict[str, str] = {}


def _write_error_artifact(job_id: str, message: str) -> None:
    try:
        base = _artifacts_dir()
        (base / f"{job_id}-error.txt").write_text(message)
    except Exception:
        pass


def _artifacts_dir() -> Path:
    d = Path(os.getenv("ARTIFACTS_DIR", "data/artifacts"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write_artifacts(job_id: str, result: dict) -> list[str]:
    base = _artifacts_dir()
    files: list[str] = []
    # JSON
    json_path = base / f"{job_id}-result.json"
    import json

    json_path.write_text(json.dumps(result, indent=2))
    files.append(json_path.name)
    # CSV summary
    csv_path = base / f"{job_id}-summary.csv"
    csv = [
        "key,value",
        f"name,{result.get('name', '')}",
        f"mesh_cells,{result.get('mesh_cells', 0)}",
        f"fields,{';'.join(result.get('fields', []))}",
    ]
    csv_path.write_text("\n".join(csv) + "\n")
    files.append(csv_path.name)
    # Minimal VTK legacy placeholder
    vtk_path = base / f"{job_id}-fields.vtk"
    vtk_content = """# vtk DataFile Version 3.0
Microfluidic Result
ASCII
DATASET POLYDATA
POINTS 0 float
POLYGONS 0 0
"""
    vtk_path.write_text(vtk_content)
    files.append(vtk_path.name)
    return files


def _flux_from_analytic(sol, side: str) -> float:
    # For rectangle, flux at inlet/outlet: integrate u_x over y
    from numpy import trapz

    u_mid = sol.u[:, sol.u.shape[1] // 2]
    return float(trapz(u_mid, sol.y))


def _flux_from_meshio(
    m,
    pdata,
    side: str,
    length: float,
    ny_hint: int = 20,
) -> float:
    import numpy as _np

    pts = m.points
    x = pts[:, 0]
    y = pts[:, 1]
    u = pdata.get("u")
    if u is None:
        return 0.0
    ux = u[:, 0]
    target_x = 0.0 if side == "inlet" else length
    k = max(10, ny_hint)
    idx = _np.argsort(_np.abs(x - target_x))[:k]
    y_sel = y[idx]
    ux_sel = ux[idx]
    order = _np.argsort(y_sel)
    y_sorted = y_sel[order]
    ux_sorted = ux_sel[order]
    from numpy import trapz

    return float(trapz(ux_sorted, y_sorted))


def _midline_l2_error_from_mesh(
    m,
    pdata,
    h: float,
    length: float,
    u_avg: float,
    ny_hint: int = 20,
) -> float:
    import numpy as _np

    pts = m.points
    x = pts[:, 0]
    y = pts[:, 1]
    u = pdata.get("u")
    if u is None:
        return float("nan")
    ux = u[:, 0]
    # Select nodes nearest to midline x=l/2
    k = max(10, ny_hint)
    idx = _np.argsort(_np.abs(x - length / 2.0))[:k]
    y_mid = y[idx]
    u_mid = ux[idx]
    order = _np.argsort(y_mid)
    y_mid = y_mid[order]
    u_mid = u_mid[order]
    # Reference profile
    u_ref = 6.0 * u_avg * (y_mid / h) * (1.0 - y_mid / h)
    from numpy import trapz

    denom = trapz(u_ref**2, y_mid)
    if denom == 0:
        return 0.0
    err = _np.sqrt(trapz((u_mid - u_ref) ** 2, y_mid) / denom)
    return float(err)


def _get_queue() -> Optional[Queue]:
    if os.getenv("INLINE_JOB_EXEC", "").strip().lower() in {"1", "true", "yes"}:
        return None
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        conn = Redis.from_url(url)
        # ping to check availability
        conn.ping()
        return Queue("jobs", connection=conn)
    except Exception:
        return None


def _dummy_solver(spec_data: dict, job_id: str) -> dict:
    # Store errors to RQ job.meta and artifact so they can be surfaced via API
    def _record_error(msg: str) -> None:
        try:
            from rq import get_current_job  # type: ignore

            j = get_current_job()
            if j is not None:
                j.meta = j.meta or {}
                j.meta["error_message"] = msg
                j.save_meta()
        except Exception:
            pass
        try:
            _write_error_artifact(job_id, msg)
        except Exception:
            pass

    # If geometry_json describes a single rectangular channel, use analytical Poiseuille solution
    try:
        gjson = spec_data.get("geometry_json")
        # If geometry_json is missing, synthesize a simple rectangle from scalar geometry (meters)
        if not gjson:
            geom = spec_data.get("geometry") or {}
            try:
                gw = float(geom.get("width", 0.0))
                gh = float(geom.get("height", 0.0))
                if gw > 0.0 and gh > 0.0:
                    gjson = {
                        "unit": "m",
                        "shapes": [
                            {
                                "id": "rect1",
                                "type": "rect",
                                "x": 0.0,
                                "y": 0.0,
                                "width": gw,
                                "height": gh,
                            }
                        ],
                    }
            except Exception:
                gjson = None
        material = spec_data.get("material", {})
        mu = float(material.get("viscosity", 1e-3))
        if gjson and isinstance(gjson, dict):
            # Determine geometry unit scale (default meters)
            unit = str(gjson.get("unit", "m")).lower()
            scale = 1.0
            try:
                if "unit_scale" in gjson:
                    scale = float(gjson.get("unit_scale") or 1.0)
                else:
                    scale = {"m": 1.0, "mm": 1e-3, "um": 1e-6, "µm": 1e-6}.get(unit, 1.0)
            except Exception:
                scale = 1.0
            shapes = gjson.get("shapes", [])
            if isinstance(shapes, list) and len(shapes) >= 1:
                rects = [s for s in shapes if s.get("type") == "rect"]
                if len(rects) >= 1:
                    r = rects[0]
                    # Scale geometry to meters
                    h = float(r.get("height", 1.0)) * scale
                    length = float(r.get("width", 1.0)) * scale
                    # inlet mean velocity heuristic
                    u_avg = 1e-3
                    for b in spec_data.get("boundaries", []):
                        if b.get("type") == "inlet" and b.get("value") is not None:
                            u_avg = float(b.get("value"))
                            break
                    # Try FEM solver first; on failure, fallback to analytic
                    try:
                        from solver.stokes_fem import solve_rect_stokes_fem

                        nx_used, ny_used = 64, 32
                        res = solve_rect_stokes_fem(
                            h=h,
                            l=length,
                            mu=mu,
                            u_avg=u_avg,
                            nx=nx_used,
                            ny=ny_used,
                            with_metrics=True,
                        )
                        # Support both (m, pdata) and (m, pdata, metrics)
                        if isinstance(res, tuple) and len(res) == 3:
                            m, pdata, metrics = res
                        else:
                            m, pdata = res  # type: ignore
                            metrics = {}
                        # export VTU
                        base = _artifacts_dir()
                        vtu_path = base / f"{job_id}-stokes.vtu"
                        import meshio as _meshio

                        _meshio.write(vtu_path.as_posix(), m)
                        # estimate L2 error and mass balance
                        try:
                            err = _midline_l2_error_from_mesh(
                                m, pdata, h=h, length=length, u_avg=u_avg, ny_hint=ny_used
                            )
                        except Exception:
                            err = None
                        # Prefer FEM-integrated fluxes if provided; else sample near boundaries
                        try:
                            q_in = (
                                float(metrics.get("flux_in"))
                                if metrics and metrics.get("flux_in") is not None
                                else _flux_from_meshio(m, pdata, "inlet", length, ny_hint=ny_used)
                            )
                            q_out = (
                                float(metrics.get("flux_out"))
                                if metrics and metrics.get("flux_out") is not None
                                else _flux_from_meshio(m, pdata, "outlet", length, ny_hint=ny_used)
                            )
                            mb = abs(q_in - q_out) / max(abs(q_in), 1e-12)
                        except Exception:
                            q_in = q_out = mb = float("nan")
                        result = {
                            "name": spec_data.get("name", "job"),
                            "mesh_cells": int(len(m.points)),
                            "fields": ["u", "v", "p"],
                            "l2_error": err,
                            "flux_in": q_in,
                            "flux_out": q_out,
                            "mass_balance_rel_error": mb,
                            "geometry": {"h_m": h, "l_m": length, "unit": unit, "scale": scale},
                        }
                        artifacts = _write_artifacts(job_id, result)
                        artifacts.append(vtu_path.name)
                        # save geometry JSON as artifact if present
                        try:
                            import json as _json

                            (base / f"{job_id}-geometry.json").write_text(
                                _json.dumps(gjson, indent=2)
                            )
                            artifacts.append(f"{job_id}-geometry.json")
                        except Exception:
                            pass
                        return {"ok": True, "result": result, "artifacts": artifacts}
                    except Exception as e:
                        _record_error(str(e))
                        from solver.stokes_rect import (
                            poiseuille_l2_error,
                            solve_stokes_poiseuille_rect,
                        )

                        sol = solve_stokes_poiseuille_rect(
                            h=h, l=length, mu=mu, u_avg=u_avg, nx=64, ny=32
                        )
                        err = poiseuille_l2_error(sol)
                        base = _artifacts_dir()
                        csv_path = base / f"{job_id}-u_mid.csv"
                        mid = sol.u[:, sol.u.shape[1] // 2]
                        with open(csv_path, "w") as f:
                            f.write("y,u\n")
                            for yi, ui in zip(sol.y, mid):
                                f.write(f"{yi},{ui}\n")
                        import json as _json

                        q_in = _flux_from_analytic(sol, "inlet")
                        q_out = _flux_from_analytic(sol, "outlet")
                        mb = abs(q_in - q_out) / max(abs(q_in), 1e-12)
                        summary = {
                            "h": sol.h,
                            "l": sol.l,
                            "u_avg": sol.u_avg,
                            "l2_error": err,
                            "flux_in": q_in,
                            "flux_out": q_out,
                            "mass_balance_rel_error": mb,
                        }
                        (base / f"{job_id}-summary.json").write_text(_json.dumps(summary, indent=2))
                        result = {
                            "name": spec_data.get("name", "job"),
                            "mesh_cells": int(sol.u.size),
                            "fields": ["u", "v", "p"],
                            "l2_error": err,
                            "flux_in": q_in,
                            "flux_out": q_out,
                            "mass_balance_rel_error": mb,
                            "geometry": {"h_m": h, "l_m": length, "unit": unit, "scale": scale},
                        }
                        artifacts = _write_artifacts(job_id, result)
                        # save geometry
                        try:
                            (base / f"{job_id}-geometry.json").write_text(
                                _json.dumps(gjson, indent=2)
                            )
                            artifacts.append(f"{job_id}-geometry.json")
                        except Exception:
                            pass
                        artifacts.extend([csv_path.name, f"{job_id}-summary.json"])
                        return {"ok": True, "result": result, "artifacts": artifacts}
    except Exception as e:
        _record_error(str(e))
        # Re-raise so the job is marked failed in queue mode; inline mode caller will catch
        raise
    # Fallback dummy work
    steps = 5
    name = spec_data.get("name", "job")
    result = {"name": name, "mesh_cells": 10000, "fields": ["u", "v", "p"]}
    for _ in range(steps):
        time.sleep(0.2)
    artifacts = _write_artifacts(job_id, result)
    return {"ok": True, "result": result, "artifacts": artifacts}


def runjob(spec_data: dict, job_id: str) -> dict:
    """Public wrapper for RQ import; delegates to _dummy_solver (no underscores for RQ)."""
    return _dummy_solver(spec_data, job_id)


@router.post("/jobs", response_model=JobStatus)
def create_job(spec: JobSpec):
    q = _get_queue()
    job_id = str(uuid4())
    if q is None:
        # Fallback: run inline (dev only)
        try:
            res = _dummy_solver(spec.model_dump(), job_id)  # blocking
            _MEM_RESULTS[job_id] = res.get("result", {})
            return JobStatus(id=job_id, status="finished", progress=1.0)
        except Exception as e:
            msg = str(e)
            _MEM_ERRORS[job_id] = msg
            _write_error_artifact(job_id, msg)
            return JobStatus(id=job_id, status="failed", progress=1.0, error=msg)
    # Enqueue by public import path to avoid issues importing private-name attributes
    job = q.enqueue(
        "workers.tasks.runjob",
        spec.model_dump(),
        job_id,
        job_id=job_id,
        job_timeout=600,
    )
    return JobStatus(id=job.id, status=job.get_status() or "queued", progress=0.0)


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    q = _get_queue()
    if q is None:
        # Inline mode: finished if result exists; failed if error recorded
        if job_id in _MEM_RESULTS:
            return JobStatus(id=job_id, status="finished", progress=1.0)
        if job_id in _MEM_ERRORS:
            return JobStatus(id=job_id, status="failed", progress=1.0, error=_MEM_ERRORS[job_id])
        raise HTTPException(status_code=404, detail="Job not found")
    job = q.fetch_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    status = job.get_status() or "unknown"
    progress = 1.0 if status in {"finished", "failed"} else 0.0
    error = None
    if status == "failed":
        try:
            # Prefer explicit meta message
            error = job.meta.get("error_message") if hasattr(job, "meta") else None
        except Exception:
            error = None
        if not error:
            try:
                exc = getattr(job, "exc_info", None)
                if exc:
                    lines = str(exc).strip().splitlines()
                    if lines:
                        error = lines[-1]
            except Exception:
                pass
        # Fallback to error artifact if present
        if not error:
            try:
                base = _artifacts_dir()
                p = base / f"{job_id}-error.txt"
                if p.exists():
                    error = p.read_text().strip().splitlines()[-1]
            except Exception:
                pass
    return JobStatus(id=job_id, status=status, progress=progress, error=error)


@router.get("/jobs/{job_id}/result")
def get_job_result(job_id: str):
    q = _get_queue()
    if q is None:
        result = _MEM_RESULTS.get(job_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Result not found")
        return {"result": result}
    job = q.fetch_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    status = job.get_status() or "unknown"
    if status != "finished":
        raise HTTPException(status_code=409, detail=f"Job status is {status}")
    if job.result is None:
        raise HTTPException(status_code=404, detail="Result missing")
    return job.result


@router.get("/jobs/{job_id}/artifacts")
def list_artifacts(job_id: str):
    base = _artifacts_dir()
    items = []
    for name in os.listdir(base):
        if name.startswith(f"{job_id}-"):
            p = base / name
            items.append(
                {
                    "name": name,
                    "size": p.stat().st_size,
                    "url": f"/api/v1/jobs/{job_id}/download/{name}",
                }
            )
    if not items:
        raise HTTPException(status_code=404, detail="No artifacts found")
    return {"artifacts": items}


@router.get("/jobs/{job_id}/download/{name}")
def download_artifact(job_id: str, name: str):
    base = _artifacts_dir()
    if not name.startswith(f"{job_id}-"):
        raise HTTPException(status_code=400, detail="Invalid artifact name")
    path = base / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    media_type = "application/octet-stream"
    if name.endswith(".json"):
        media_type = "application/json"
    elif name.endswith(".csv"):
        media_type = "text/csv"
    elif name.endswith(".vtk"):
        media_type = "text/plain"
    return FileResponse(path, media_type=media_type, filename=name)
