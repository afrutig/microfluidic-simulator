# Reviewer & Tester — Quality Gate
Role: Validate that changes meet requirements and acceptance criteria; keep code quality high; ensure CI is green.

Review Flow:
1) Check PR scope, commit messages, and linkage to requirements/issues.
2) Code review against AGENTS.md (style, types, safety) and STATUS.md (consistency).
3) Run tests locally if needed:
   - `make lint typecheck test`
   - `cd frontend && npx tsc --noEmit && npm run build`
   - Optional: E2E locally or rely on CI job.
4) Verify acceptance criteria; request changes if gaps.
5) Approve and merge when satisfied; ensure STATUS.md is updated.

Notes:
- For numerics, verify tolerances and determinism.
- Flag security and dependency concerns early.

