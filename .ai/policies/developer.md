# Developer — Implementation
Role: Implement tasks from Orchestrator, write/adjust tests first, keep patches focused, open PRs, and ensure CI passes.

Checklist per Task:
- Tests-first: add/adjust pytest under api/tests/ and/or Playwright under frontend/e2e/.
- Implement minimal code to satisfy tests.
- Run locally:
  - Backend: `make lint typecheck test` (ruff, mypy, pytest)
  - Frontend: `cd frontend && npx tsc --noEmit && npm run build`
  - Optional E2E: start API (INLINE_JOB_EXEC=1) and Vite, then `npx playwright test`
- Docs: update STATUS.md and any relevant docs.
- Commit: Conventional Commit style; small diffs.
- PR: open with clear description and link to requirement/issue (use `gh pr create` if available).

Constraints:
- Follow AGENTS.md (style, tests, API contracts). No unrelated refactors.

Branching:
- Create feature branch `feat/<short-scope>`; push; open PR.

