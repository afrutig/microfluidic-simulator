# AGENTS.md — Working Guidelines for AI & Human Contributors

This file defines how agents should work in this repository. Its scope is the entire repo. For any file you change, follow these conventions unless a more specific AGENTS.md exists deeper in the tree.

## Purpose
- Build a microfluidic simulation web app with a React (TypeScript) frontend and a FastAPI (Python) backend, plus workers and a solver core.
- Implement changes spec‑first, keep code typed, deterministic, and testable.
- Keep modifications minimal and focused; prefer small, reviewable patches.

## Repository Layout
- `frontend/` — React + TypeScript + Vite + MUI UI.
- `api/` — FastAPI app with Pydantic models and tests.
- `workers/` — Background job runner (Redis/RQ) and tasks.
- `solver/` — Numerical core for Stokes/transport and utilities.
- `infra/` — Docker Compose for dev/prod‑like runs.
- `docs/` — MkDocs docs; `mkdocs.yml` at root.
- `scripts/` — Bootstrap, OpenAPI generation, helpers.
- `High-Level-Requirements.md` — Product requirements and roadmap.

## Toolchain & Runtime
- Python: 3.11 (min 3.10). Install dev deps via `pip install -e api[dev]`.
- Node.js: 20.x LTS. Use `npm ci` for reproducible installs.
- Redis: required for workers (see `infra/docker-compose.yml`).
- Optional: Docker Desktop + `docker compose` for integrated runs.

## Local Development
- One‑command: `bash scripts/bootstrap.sh` (auto‑detects Docker; see README).
- Manual API: `uvicorn api.app.main:app --reload`.
- Manual worker: `python workers/worker.py` (ensure Redis is running).
- Frontend dev: `cd frontend && npm install && npm run dev`.
- Makefile helpers: `make install`, `make lint`, `make typecheck`, `make test` (Python only).

## CI (GitHub Actions)
- On push/PR, CI runs:
  - Backend: ruff (lint), mypy (typecheck), pytest (tests) on `api/` with Python 3.11.
  - Frontend: `tsc --noEmit` and `vite build` with Node 20.
- Keep changes compatible with CI; avoid adding global state or networked tests.

## Coding Standards
### Python (api/, solver/, workers/)
- Style: ruff with line length 100; import order enforced by ruff (`E,F,I`).
- Types: mypy required (target 3.11). Prefer explicit types on public functions.
- FastAPI + Pydantic v2 for schemas; use `pydantic-settings` for config.
- Performance‑sensitive code may use NumPy/SciPy; isolate optional heavy deps and guard tests with `pytest.importorskip`.
- Errors: raise precise exceptions; return structured error responses (FastAPI) with clear messages.
- Logging: use `logging` with structured messages; avoid print.

### TypeScript/React (frontend/)
- Strict TypeScript; no `any` unless unavoidable and justified.
- Functional components with hooks; colocate component styles and tests.
- UI: Material UI (MUI) components and theme in `frontend/src/theme.tsx`.
- API types: generated via OpenAPI; do not hand‑roll types for server models.

## API Contracts & Client Generation
- Source of truth: FastAPI routes + Pydantic schemas.
- If you change the API/schemas:
  1) Update server code and `api/openapi.json` generation.
  2) Regenerate TS client: `cd frontend && npm run gen:api:local` (dev) or `gen:api` against a running API.
  3) Update affected frontend code to use the regenerated types.

## Testing Guidelines
- Python unit tests live in `api/tests/` (and may be added in `solver/tests/` if needed).
- Determinism: use fixed seeds when randomness is involved; set numeric tolerances explicitly.
- Heavy/optional deps: use `pytest.importorskip("skfem")` (pattern already used) to keep CI green without optional packages.
- Do not perform network calls in tests. Mock IO and services.
- When modifying numerics, add a benchmark test (e.g., Poiseuille profile) with tolerances.

## Workers & Jobs
- Queue: Redis + RQ. Do not block FastAPI request handlers for long tasks.
- Jobs should be idempotent and resumable when feasible; log progress and key metrics.
- Boundaries/parameters validated in the API before enqueuing.

## Security & Secrets
- Never commit secrets. Use `.env` files locally and CI secrets for pipelines.
- Validate and sanitize all user inputs (geometry, materials, files). Enforce size and type limits.
- Keep dependencies up‑to‑date; prefer stable, well‑maintained packages.

## Contribution Workflow
- Branch naming: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- Commits: Conventional Commits (e.g., `feat(api): add sweep router`).
- PRs: small, focused; include tests and a short rationale linking to requirements in `High-Level-Requirements.md`.
- Do not refactor unrelated code in the same PR.

## Definition of Done (MVP‑aligned)
- Code passes CI (lint, typecheck, tests, build).
- Public functions and API routes typed and documented.
- For solver changes: benchmark tests meet stated tolerances.
- Frontend compiles with no TS errors; UX uses MUI patterns consistently.

## File Ownership Hints
- `api/app/routers/*` — API routes and validation.
- `solver/*` — numerics (keep well‑tested; small PRs).
- `workers/*` — task orchestration; ensure Redis availability.
- `frontend/src/*` — UI; keep components small and typed.

## Contact & Decisions
- Architectural decisions: record briefly in PR description or an ADR under `docs/adr/` if non‑trivial.
- When in doubt, follow the simplest approach that satisfies tests and requirements.
