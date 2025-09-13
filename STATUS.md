# Project Status and Development Guide

This document summarizes the current implementation, what works, known issues, and how to extend the application safely. Treat this as the living “cornerstone” for development.

## Overview
- Stack
  - Frontend: React + TypeScript + Vite + MUI (`frontend/`)
  - Backend: FastAPI + Pydantic v2 (`api/`), background jobs via Redis/RQ (`workers/`)
  - Numerics: Analytic and FEM solvers (`solver/`)
  - Infra: Docker Compose (`infra/`)
  - CI: GitHub Actions with lint, type-check, unit tests, and Playwright E2E
- Key Capabilities
  - Submit “jobs” with geometry/materials; execute inline (dev) or queued (RQ)
  - Produce artifacts (JSON summary, CSV, VTK/VTU) and download endpoints
  - Basic pages: New Job, Job Status, Jobs list, Projects, Sweeps, simple Editor, VTK viewer

## Current Test Results (local)
- Python unit tests (pytest): PASS
  - Command: `PYTHONPATH=. pytest -q api/tests`
  - Result: 6 passed (with numpy `trapz` deprecation warnings)
- Lint (ruff): PASS
  - Command: `ruff check api`
- Type check (mypy): FAILING with a few issues
  - Typical errors:
    - `Module "numpy" has no attribute "trapz"` (stubs issue)
    - Missing stubs for `scipy.sparse`, `meshio`, `skfem`
- Frontend TypeScript: PASS
  - Command: `cd frontend && npx tsc --noEmit`
- Frontend Build: PASS (with warnings)
  - Command: `cd frontend && npm run build`
  - Notes: Vite warns about duplicate `scripts` key in `package.json` (merge needed), and large bundle size.
- Playwright E2E: CONFIGURED IN CI
  - Local run requires Node 20+. CI runs E2E against Dockerized API+Frontend.

## What Works (validated)
- API
  - Health endpoint: `GET /health` → `{ "status": "ok" }`
  - Job submission and execution inline (without Redis):
    - `POST /api/v1/jobs` returns `{ id, status: finished }`
    - `GET /api/v1/jobs/{id}` returns status
    - `GET /api/v1/jobs/{id}/artifacts` lists `*-result.json, *-summary.csv, *-fields.vtk, *-geometry.json` and in FEM mode `*-stokes.vtu`
  - FEM solver path works when `skfem` + `meshio` are present; otherwise the analytic path runs
- Frontend
  - Builds with Vite and TypeScript type-checks cleanly
  - Pages and routing scaffolding in place; API client uses OpenAPI-generated types
- CI
  - Backend job: ruff, mypy, pytest
  - Frontend job: TypeScript type-check and Vite build
  - E2E job (Playwright): spins API + Frontend via Docker Compose and runs a smoke test

## Known Issues / Gaps
- mypy type errors
  - `numpy.trapz` not present in stubs → errors like `attr-defined`
  - Missing stubs for `scipy`, `meshio`, `skfem`
  - Options to resolve:
    - Prefer `numpy.trapezoid` or wrap calls with `typing.cast`/`# type: ignore[attr-defined]`
    - Install stubs where available: `pip install scipy-stubs` (and consider adding types for `meshio` / `skfem` or ignore)
    - Narrow mypy to skip selected files or error codes (least preferred)
- Frontend Node version
  - Vite and Playwright expect Node `^18.19` or `>=20`; Node 19 is unsupported
  - Fix: use Node 20 LTS locally (e.g., `nvm install 20 && nvm use 20`)
- Frontend `package.json` warning
  - Duplicate `scripts` key detected (merge the two `scripts` objects into a single one)
- VTK asset copy
  - `postinstall` copies `@kitware/vtk.js/dist/vtk.js` which may not exist in current version layout; the step is optional and already guarded by `|| true`.

## How To Run Locally
- Backend (Python ≥ 3.10 recommended)
  - `python -m venv .venv && source .venv/bin/activate`
  - `pip install -U pip`
  - `pip install -e api[dev]` (installs pytest/ruff/mypy/etc.)
  - Dev server: `INLINE_JOB_EXEC=1 uvicorn api.app.main:app --reload`
- Frontend (Node 20)
  - `cd frontend && npm ci`
  - Dev server: `VITE_API_PROXY_TARGET=http://localhost:8000 npm run dev`
- Docker Compose (prod-like)
  - `cd infra && docker compose up -d --build` → Frontend at `http://localhost:8080`, API at `http://localhost:8000`

## How To Run Tests
- Unit tests (backend): `pytest -q api`
- Lint (backend): `ruff check api`
- Types (backend): `mypy api`
- TypeScript (frontend): `cd frontend && npx tsc --noEmit`
- Playwright E2E (locally)
  - Ensure Node 20: `nvm use 20`
  - In one terminal, start API: `INLINE_JOB_EXEC=1 uvicorn api.app.main:app`
  - In another, start frontend dev server: `cd frontend && npm ci && npm run dev`
  - Run tests: `cd frontend && npx playwright install --with-deps && E2E_BASE_URL=http://localhost:5173 npx playwright test`
- Playwright E2E (CI): triggered automatically on push/PR

## Extension Plan (mapping Requirements → Tests → Impl)
1) Geometry & Import
- Add tests for SVG/DXF import endpoints (`api/app/routers/imports.py`) with fixtures
- Frontend: add Playwright tests for importing a sample design and validating parsed regions
2) Meshing & Solvers
- Unit tests for meshing hooks and quality metrics (when implemented)
- Golden-result tests for Poiseuille (analytic vs FEM) with tolerances; add more benchmarks
3) Jobs & Sweeps
- API tests for sweeps creation, progress aggregation, and artifacts bundle
- Frontend E2E: create sweep from UI, verify consolidated CSV/plots
4) Post-processing & Viewer
- API tests for generated VTU/VTK validity (simple schema checks via `meshio`)
- Playwright tests: open viewer, verify basic rendering and download links
5) Projects & Persistence
- API tests for CRUD with realistic payloads and validation errors
- Playwright: create/edit/delete projects, open geometry in editor

For each new requirement:
- Write/extend tests first (pytest or Playwright) → push → ensure CI fails for the right reason → implement → push → CI green.

## Quality Gates to Add Next
- Coverage for backend: `pytest --cov=api --cov-fail-under=80` and upload to Actions summary
- ESLint/Prettier for frontend with CI check
- Security scans: `pip-audit` and `npm audit` (CI optional and non-blocking initially)
- Bundle analysis for frontend to track size regressions

## Notes on Queue vs Inline Execution
- Dev should prefer inline (`INLINE_JOB_EXEC=1`) to avoid Redis setup
- CI E2E uses Docker Compose; production should use Redis/RQ workers (`workers/`)

## Action Items (short-term)
- Fix mypy by addressing numpy `trapz` errors and missing stubs (or ignore selectively)
- Merge duplicate `scripts` in `frontend/package.json`
- Ensure Node 20 locally; document with `.nvmrc` (optional)
- Expand Playwright coverage: Jobs list → View artifacts → Viewer
- Add coverage thresholds for backend

---
Maintainers: keep this file updated as features and tests evolve. When you merge a requirement, include its tests and update this status.
