# Microfluidic Simulator (Spinoff, AI‑First)

This monorepo contains a React frontend, a FastAPI backend, background workers, and a nascent solver core. It is designed to be developed and maintained by AI coding agents with human oversight.

- Frontend: `frontend/`
- API: `api/`
- Workers: `workers/`
- Solver: `solver/`
- Infra: `infra/`
- Docs: `docs/` + `mkdocs.yml`
- AI Policies: `.ai/`

See `High-Level-Requirements.md` for product scope.

## One-Command Run

Pick one of the following:

- With Docker Desktop and `just` installed:
  - Prod-like: `just` or `just up` → http://localhost:8080
  - Dev (hot reload): `just dev` → http://localhost:5173 (API at http://localhost:8000)

- Without `just` (auto-detects Docker):
  - `bash scripts/bootstrap.sh`
    - If Docker is running: generates OpenAPI and runs `docker compose up --build` (frontend on 8080).
    - If Docker is not available: starts local dev servers (frontend on 5173; API on 8000).

## Quick Start (manual dev)
- API (local): `uvicorn api.app.main:app --reload`
- Worker: `python workers/worker.py`
- Tests: `pytest`

Frontend:
- Dev: `cd frontend && npm install && npm run dev` (requires API at `http://localhost:8000`)
- Configure API URL via `frontend/.env` with `VITE_API_BASE_URL`
  - Alternatively, rely on Vite proxy: the app defaults to using `/api` and the dev server proxies to `VITE_API_PROXY_TARGET` (defaults to `http://localhost:8000`).

Docker Compose (prod-like):
- From `infra/`: `docker compose up --build`
- Open frontend at `http://localhost:8080` (frontend), API at `http://localhost:8000`
- To change API base URL for container build: set build arg `API_BASE_URL` in `infra/docker-compose.yml`

Docker Compose (dev with hot-reload):
- From `infra/`: `docker compose --profile dev up --build frontend-dev api redis`
- Open `http://localhost:5173` for Vite dev server; API at `http://localhost:8000`
- Frontend dev server uses proxy with `VITE_API_PROXY_TARGET=http://api:8000` inside the compose network

OpenAPI TS client (optional):
- Run API locally, then `cd frontend && npm run gen:api` to generate `src/api/generated.ts`

## License
Proprietary — see EULA to be added.
