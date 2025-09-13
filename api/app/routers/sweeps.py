from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .jobs import _get_queue

router = APIRouter()


class SweepCreate(BaseModel):
    name: str
    base: dict
    variants: list[dict]


class SweepStatus(BaseModel):
    id: str
    jobs: list[dict]
    done: bool


SWEEPS: dict[str, list[str]] = {}


@router.post("/sweeps")
def create_sweep(payload: SweepCreate):
    q = _get_queue()
    if q is None:
        raise HTTPException(status_code=503, detail="Queue unavailable")
    batch_id = str(uuid4())
    job_ids: list[str] = []
    for v in payload.variants:
        spec = {**payload.base, **v}
        # Use public workers.tasks path to avoid import attribute resolution issues
        job = q.enqueue("workers.tasks.runjob", spec, str(uuid4()), job_timeout=600)
        job_ids.append(job.id)
    SWEEPS[batch_id] = job_ids
    return {"id": batch_id, "jobs": job_ids}


@router.get("/sweeps/{sid}", response_model=SweepStatus)
def get_sweep(sid: str):
    q = _get_queue()
    if q is None:
        raise HTTPException(status_code=503, detail="Queue unavailable")
    ids = SWEEPS.get(sid)
    if ids is None:
        raise HTTPException(status_code=404, detail="Sweep not found")
    jobs = []
    done = True
    for jid in ids:
        job = q.fetch_job(jid)
        if job is None:
            jobs.append({"id": jid, "status": "unknown"})
            continue
        status = job.get_status() or "unknown"
        jobs.append({"id": jid, "status": status})
        if status not in {"finished", "failed"}:
            done = False
    return {"id": sid, "jobs": jobs, "done": done}


@router.get("/sweeps/{sid}/csv")
def get_sweep_csv(sid: str):
    import csv
    import io

    from fastapi.responses import PlainTextResponse

    q = _get_queue()
    if q is None:
        raise HTTPException(status_code=503, detail="Queue unavailable")
    ids = SWEEPS.get(sid)
    if ids is None:
        raise HTTPException(status_code=404, detail="Sweep not found")
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["job_id", "mesh_cells", "fields"])
    for jid in ids:
        job = q.fetch_job(jid)
        if job and job.result and isinstance(job.result, dict):
            res = job.result.get("result", {})
            w.writerow([jid, res.get("mesh_cells", ""), ";".join(res.get("fields", []))])
    return PlainTextResponse(out.getvalue(), media_type="text/csv")
