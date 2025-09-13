from __future__ import annotations

import os
from pathlib import Path


def _artifacts_dir() -> Path:
    d = Path(os.getenv("ARTIFACTS_DIR", "/data/artifacts"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _record_error(job_id: str, msg: str) -> None:
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
        base = _artifacts_dir()
        (base / f"{job_id}-error.txt").write_text(msg)
    except Exception:
        pass


def runjob(spec_data: dict, job_id: str) -> dict:
    """Public RQ task entrypoint. Delegates to API job function; records import errors."""
    # Import lazily to avoid circular imports at worker boot
    try:
        from api.app.routers.jobs import _dummy_solver  # type: ignore
    except Exception as e:  # ImportError and others
        _record_error(job_id, f"ImportError in worker: {e}")
        raise
    return _dummy_solver(spec_data, job_id)
