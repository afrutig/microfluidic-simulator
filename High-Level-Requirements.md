# Microfluidic Simulation Web App (React + FastAPI) — AI‑First High‑Level Requirements

## 1) Vision & Goals
- Deliver an accurate, browser‑based microfluidic simulator with a React frontend and a Python FastAPI backend.
- AI coding agents implement, maintain, and release the product end‑to‑end under human oversight.
- Compute runs on the server; the frontend handles modeling, job submission, and visualization.
- Optimize for a solo developer + AI agents: machine‑checkable specs, typed API with Pydantic, deterministic CI/CD, containerized deploys.
- Start with high‑value microfluidics: low‑Reynolds laminar flow and transport; expand iteratively.

## 2) Target Users & Key Use Cases
- **Academia (researchers/students):** Rapid device prototyping, parameter sweeps, teaching fundamentals.
- **Industry R&D (biotech/medtech/chem):** Early design exploration, sensitivity analysis, feasibility studies.
- **Consultants/SMEs:** Quick studies, reproducible reports, client‑ready visuals.

Typical workflows:
- Sketch or import 2D channel networks, assign inlets/outlets, materials, run steady flow + species transport, visualize streamlines/concentration, export plots/data.
- Batch parameter sweeps (geometry, viscosity, flow rates) to identify optimal designs.
- Validate against canonical benchmarks and simple analytics before scaling complexity.

## 3) Product Scope
### MVP (client–server core)
- 2D planar, single‑phase, incompressible, Newtonian, laminar flow (steady state).
- Passive scalar convection–diffusion (steady) with optional first‑order decay/reaction.
- Geometry via in‑app primitives (channels, chambers, inlets/outlets) and import of SVG/DXF and STEP/IGES (2D section/projection).
- Automatic unstructured meshing with local refinement; mesh quality indicators.
- Boundary conditions: pressure/velocity inlets, pressure outlets, no‑slip walls, species flux.
- Solver: robust FEM/FVM implemented in Python with compiled extensions as needed; runs on the server.
- Post‑processing: server computes fields; frontend renders streamlines/contours and exports figures/data.
- Parameter sweeps executed as server jobs; deterministic, reproducible runs.
- Projects persisted on the backend (database + object storage) with export/import of a single archive including metadata and provenance.

### v1 (after MVP product–market fit)
- Time‑dependent flow and transport; transient sources/sinks; checkpoint/restore.
- Non‑Newtonian (power‑law) fluids.
- Geometry parameters and simple optimizers (grid/Latin Hypercube; basic DOE outputs).
- Template gallery for common devices; sharable, read‑only links to example setups.
- Optional hybrid compute (GPU‑accelerated or compiled solvers) behind the API for performance.

### v2+ (directional, not committed)
- 3D extruded models; thermal coupling; electrokinetics; capillarity models.
- Collaborative annotations and project sharing; organization workspaces and RBAC.
- Scalable multi‑node job execution with a queue and worker pool.

## 4) Core Functional Requirements
- **Geometry & Import (frontend):**
  - Primitives: straight/curved channels, T/Y junctions, contraction/expansion, chambers.
  - Boolean ops (union/subtract), fillets; parameterized sketches; units.
  - Geometry editor (web): MUI‑based 2D editor with pan/zoom, snap grid, add/select/move/resize/rotate primitives; inspector for dimensions/units; undo/redo.
  - Import: SVG/DXF (2D) and STEP/IGES (2D section/projection). SVG client‑side import; DXF/STEP/IGES via backend parsing with mapping to regions/BCs; tolerance/scale controls; unit normalization.
- **Meshing (backend):**
  - Automatic triangular meshing with size fields; curvature/wall‑distance refinement.
  - Mesh quality metrics (skewness, aspect ratio); mesh independence assistant.
- **Physics (backend):**
  - Governing equations: steady incompressible Navier–Stokes (low Re), scalar convection–diffusion.
  - Materials: density, viscosity, diffusivity; temperature‑independent (MVP).
  - Boundary conditions library and material/BC assignment UI + validation.
- **Solvers (backend):**
  - Stable FEM/FVM formulations; linearization (Picard) for steady NS; residual monitoring.
  - Convergence/stop criteria; progress reporting; checkpoints and logs.
- **Post‑Processing:**
  - Fields: velocity, pressure, vorticity, shear, species concentration.
  - Visuals: contours, vectors, streamlines, line/point probes, region integrals (rendered in frontend via WebGL2).
  - Export: PNG/SVG from the frontend; CSV/VTK/VTU/XDMF and summary HTML/PDF prepared by the backend.
- **Jobs & Sweeps:**
  - Create jobs from the UI; server queues and executes; progress via WebSocket/SSE.
  - Parameter sweeps with consolidated CSV + plots; deterministic runs with seedable randomness (if any).
- **Extensibility & Safety:**
  - Backend plugin hooks for custom BCs/material laws (sandboxed execution, narrow API surface).

## 5) Non‑Functional Requirements
- **Accuracy:**
  - Benchmarks within agreed tolerances vs. analytical/peer solver references: velocity/pressure L2 error < 2–5% on standard tests; mass balance error < 0.5%.
- **Performance (server):**
  - MVP target: 2D domains up to ~500k cells per job on a modest server; typical demo solves complete in < 5 minutes.
  - Queue supports concurrent jobs; fair scheduling; backpressure to the UI.
- **Usability:**
  - Onboarding tutorial; wizards for geometry/BCs; sensible defaults; unit checking; undo/redo.
  - Responsive UI; works on 13–27" screens; touch‑friendly pan/zoom.
  - Consistent Material UI (MUI) theme with light/dark modes; persisted preference (localStorage).
  - Use MUI components for forms, navigation, dialogs, tables; minimal custom CSS.
- **Reliability:**
  - Job retries with exponential backoff; resumable checkpoints; deterministic runs given same inputs/seed; meaningful error messages.
- **Portability:**
  - Frontend: Chrome/Edge/Firefox/Safari (latest 2 versions).
  - Backend: Linux containers (x86_64); deployable on a single VM or container orchestrator.
- **Security:**
  - HTTPS everywhere; JWT or session auth; role‑based access (later); rate limiting and request size limits.
  - Input validation via Pydantic; strict CORS; CSRF protection for state‑changing endpoints.
- **Maintainability (solo‑friendly):**
  - Typed code (TypeScript/Pydantic), clear module boundaries; CI with tests and linting; reproducible builds (Docker).

## 6) Data & File Formats
- **Project format:** Single archive (.mfproj.zip) containing JSON inputs, geometry, mesh, results metadata, and provenance; versioned schema.
- **Storage:** Metadata in a relational DB; large artifacts (meshes/results) in object storage; downloadable bundles.
- **Import:** DXF/SVG; STEP/IGES via backend parsers; CSV for parameter tables.
- **Export:** CSV (probes/aggregates), VTK/VTU/XDMF (fields), PNG/SVG (figures), HTML/PDF report.
- **Provenance:** Record app version, API version, solver build hash, OS/hardware; embed for reproducibility.

## 7) Interfaces & Integrations
- **GUI (React + MUI):** SPA built with React + TypeScript and Material UI (MUI). Unified theme via `ThemeProvider` with design tokens (colors, typography, spacing), light/dark modes, Material Icons. Canvas/SVG editor for geometry and WebGL viewport for fields.
- **API (FastAPI):** REST + WebSocket; OpenAPI schema; generated TypeScript client for the frontend.
- **Job Specs:** YAML/JSON job specs; upload/validate via API; batch UI for sweeps; downloadable logs.
- **Auth:** Email/password or OAuth later; JWT or session cookies; password reset flow.
- **Version Control:** Project archives are deterministic; easy to track in Git if desired.

## 8) Licensing, Pricing, and Delivery
- **Delivery:** Frontend served as static assets; backend as containerized FastAPI service behind HTTPS.
- **Licensing:** Account‑based licensing enforced server‑side; offline grace period for self‑host; 14‑day trial.
- **Pricing (initial hypothesis):** Academic discount; individual commercial; small team tier.
- **Compliance:** Third‑party licenses tracked; EULA/ToS; export compliance.

- **Docs site:** Task‑oriented guides, solver notes, API reference (OpenAPI/Swagger), in‑app tooltips; quickstart within 10 minutes.
- **Design system:** Storybook (or MUI docs pages) with themed components, variants, and accessibility notes; guidance on when to extend vs. use stock components.
- **Examples:** Curated microfluidic templates (T‑junction, mixer, contraction/expansion, serpentine).
- **Support:** Email + web issue tracker; response within 2 business days; community forum later.
- **Education:** Cite‑as text, reproducible example projects, unit conversion cheatsheets.

## 10) Validation, Verification, and QA
- **Analytical benchmarks:** Poiseuille flow, lid‑driven cavity (low Re), diffusion in a channel.
- **Method of Manufactured Solutions (MMS):** Basic manufactured cases for solver verification.
- **Cross‑solver checks:** Compare to open references where licensing permits (documented deltas).
- **Regression suite:** Golden results (hash + tolerances) for examples and bug fixes; deterministic project archives.
- **System tests:** End‑to‑end tests hitting API + UI; load tests for job queue and solver throughput.

## 11) Technical Constraints & Architecture (high level, non‑binding)
- **Frontend:** React + TypeScript SPA; state via Zustand/Redux; React Router; code splitting; WebGL renderer.
- **Backend:** FastAPI (Python) with Pydantic models; uvicorn/gunicorn; background jobs via a queue (e.g., RQ/Celery) and workers.
- **Compute core:** Python numerics with compiled extensions as needed; deterministic solvers; optional C++/Rust bindings later.
- **Storage:** Relational DB (e.g., Postgres) for metadata; object storage (e.g., S3 compatible) for artifacts.
- **Messaging:** Redis (or equivalent) for queues; WebSocket or Server‑Sent Events for progress updates.
- **Security:** HTTPS/TLS termination; JWT/session auth; CORS/CSRF protection; request/response validation.
- **Packaging:** Docker images for API and workers; IaC templates for single‑VM and cloud deploy.
- **Safety:** Graceful failure on singular/ill‑posed problems; diagnostics and guidance in responses.

## 12) Telemetry & Analytics (opt‑in only)
- Anonymous environment info (browser, OS, CPU) and server metrics (queue wait, job duration), with clear toggle.
- Data stored server‑side with export; user can inspect and opt out entirely; no sensitive geometry or results without explicit consent.

## 13) Accessibility & Internationalization
- WCAG 2.1 AA: sufficient color contrast, scalable fonts, visible focus outlines, skip‑to‑content, proper roles/labels for all controls.
- Keyboard‑navigable UI with ARIA; leverage MUI components for built‑in a11y patterns.
- SI units throughout; locale‑aware number formatting (display only).

## 14) Risks & Mitigations
- **Server costs and scaling:** Start single‑node; add queue and worker autoscaling; enforce limits and quotas.
- **Long‑running jobs/timeouts:** Background workers with heartbeats; checkpointing; resumable runs.
- **Numerical instability:** Stabilization schemes; mesh/Pe checks; solver diagnostics and suggestions.
- **Security/privacy:** Strict validation, auth, and isolation; encrypted storage; audit logs.
- **Support burden:** Clear errors, self‑serve docs, reproducible bug report capture (export bundle).
- **Scope creep:** Milestoned releases; strict MVP boundary; transparent roadmap.

- **M0 — Foundations (2–4 weeks):** Detailed spec, benchmarks list, FastAPI + Pydantic API skeleton, job queue spike, React scaffold.
- **M1 — MVP Core (6–10 weeks):** Geometry editor, API integration, server meshing + steady solver, WebGL post‑proc, projects and jobs, MUI theme.
- **M2 — Sweeps & Templates (4–6 weeks):** Batch runner, job specs, example gallery, export/reporting, authentication.
- **M3 — Beta & Docs (4–6 weeks):** Performance passes, telemetry opt‑in, docs site, tutorials; early adopter feedback.
- **M4 — v1 Launch (4 weeks):** Licensing/pricing, support processes, hardened deploys.

## 16) Acceptance Criteria (MVP)
- User designs/imports a 2D device in the React app, submits a job, sees live progress, and downloads results without errors.
- UI uses MUI components and a consistent theme across all major screens; light/dark toggle persists.
- Poiseuille and diffusion benchmarks within stated tolerances on default meshes.
- Typical 2D demo solves in < 5 minutes on a small server instance; concurrent users do not starve each other.
- Deterministic reruns (bitwise or within tiny numeric tolerance); project export/import is lossless.
- Parameter sweep for at least 20 cases runs server‑side and produces consolidated CSV + plots for download.

## 17) AI Development Loop & Governance
- **Roles:** Planner, Implementer, Reviewer, QA, Release (agent personas with prompts stored in `/.ai/policies/`).
- **Spec‑first:** User stories and API contracts (OpenAPI/Pydantic) are the source of truth; agents generate code from specs.
- **Proposal → Patch → Review:** Agents open design proposals (ADR) and patch PRs; separate reviewer agent enforces gates.
- **Guardrails:** No secrets in code; no network in tests unless mocked; read‑only production data in staging.
- **Traceability:** Every change links to requirement IDs and tests; auto‑generated changelog and release notes.

## 18) Repository & Tooling (AI‑friendly)
- **Monorepo:** `frontend/` (React+TS), `api/` (FastAPI), `workers/` (jobs), `solver/` (numerics core), `infra/` (IaC), `docs/`, `.ai/` (prompts, playbooks).
- **Dev containers:** Reproducible dev with `devcontainer.json` and Docker Compose; agents use the same env locally and in CI.
- **Code standards:** Prettier/ESLint, mypy/ruff, Black, isort; conventional commits; semantic versioning.
- **API schema:** OpenAPI generated from FastAPI; TS client generated on build to keep types in sync.
- **Make/Task:** Common tasks (`make test`, `make lint`, `make e2e`, `make bench`, `make release`) for agents to invoke.

## 19) CI/CD & Quality Gates
- **Pipelines:** Lint → Typecheck → Unit → Integration (API+UI) → E2E → Benchmarks → Security scan → Package.
- **Coverage:** Minimum unit coverage 80%; critical modules 90%; mutation testing for solvers where feasible.
- **Determinism:** Golden‑result tests with numeric tolerances; seed control; flaky test quarantine with auto‑triage.
- **Security:** SAST/DAST, dependency scanning (pip/audit + npm audit), license policy allowlist.
- **Releases:** Auto versioning with changelog; canary environment; one‑click rollback; SBOM attached to artifacts.

## 20) Documentation & Knowledge Base
- **Docs as code:** MkDocs or Docusaurus in `docs/`; API reference from OpenAPI; solver notes and benchmarks.
- **Examples gallery:** Versioned, runnable projects with expected outputs; used as regression tests.
- **RAG dataset:** Curated internal docs indexed for agent retrieval; updated on merge.
- **User assistance:** In‑app guided tours; error IDs with deep links to docs.

## 21) Security, Privacy, and Secrets
- **Secrets mgmt:** `.env` templates; secrets only via vault/CI; no plaintext secrets in repo.
- **AuthN/Z:** JWT/session with refresh; optional SSO later; audit logs; rate limiting; request/response size caps.
- **Data isolation:** Per‑tenant encryption at rest (object storage); signed URLs for downloads; PII‑free telemetry.
- **Compliance path:** Documented data flows; ready for SOC2‑lite later; export control checks for distribution.

## 22) Business & Spinoff Readiness
- **Licensing:** Named‑user or floating seats; academic pricing; trial with usage caps; server verifies entitlements.
- **Packaging:** Docker images for API/workers; Helm or Terraform modules; static hosting for frontend.
- **Support:** SLA targets; issue templates; crash reports (opt‑in); usage analytics (privacy‑preserving).
- **KPIs:** Active projects, job success rate, median solve time, retention; dashboards for go‑to‑market.

---
These are intentionally high‑level to guide scoping, de‑risk a solo‑maintainable product, and prioritize early user value in microfluidics. Subsequent design docs can refine architecture, UI flows, and numerics per milestone.
