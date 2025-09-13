#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"

echo "[bootstrap] Working dir: $root"

have_docker() {
  docker info >/dev/null 2>&1
}

gen_openapi_with_docker() {
  echo "[bootstrap] Generating OpenAPI via dockerized Python"
  docker run --rm -v "$root":/app -w /app python:3.11-slim \
    sh -c "pip install --no-cache-dir fastapi pydantic uvicorn redis rq python-multipart numpy >/dev/null && python scripts/generate_openapi.py api/openapi.json"
}

run_compose() {
  echo "[bootstrap] Starting Docker Compose (API, worker, redis, frontend)"
  ( cd "$root/infra" && docker compose up --build )
}

run_local_dev() {
  echo "[bootstrap] Docker not available. Starting local dev servers (API + Vite)"

  # Python backend (venv)
  if [ ! -d "$root/.venv" ]; then
    echo "[bootstrap] Creating Python venv"
    python3 -m venv "$root/.venv"
  fi
  # shellcheck disable=SC1091
  source "$root/.venv/bin/activate"
  python --version
  pip install --upgrade pip >/dev/null
  pip install fastapi "uvicorn[standard]" pydantic redis rq >/dev/null

  echo "[bootstrap] Launching API at http://localhost:8000"
  ( cd "$root" && python -m uvicorn api.app.main:app --reload ) &
  api_pid=$!

  # Frontend (Vite dev server)
  echo "[bootstrap] Installing frontend deps (if needed)"
  ( cd "$root/frontend" && npm install --silent )
  echo "[bootstrap] Launching frontend at http://localhost:5173"
  ( cd "$root/frontend" && npm run dev -- --host 0.0.0.0 --port 5173 ) &
  fe_pid=$!

  trap 'echo "[bootstrap] Stopping..."; kill $api_pid $fe_pid >/dev/null 2>&1 || true; exit 0' INT TERM
  echo "[bootstrap] Open http://localhost:5173 in your browser. Press Ctrl+C to stop."
  wait
}

if have_docker; then
  if gen_openapi_with_docker; then
    run_compose || {
      echo "[bootstrap] Docker Compose failed; falling back to local dev" >&2
      run_local_dev
    }
  else
    echo "[bootstrap] OpenAPI generation via Docker failed; falling back to local dev" >&2
    run_local_dev
  fi
else
  run_local_dev
fi
