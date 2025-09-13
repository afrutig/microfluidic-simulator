#!/usr/bin/env bash
set -euo pipefail

# Spawns three agent shells (orchestrator, developer, reviewer) using tmux.
# If the Codex CLI is installed, each pane starts it with the corresponding
# policy prompt from .ai/policies/*.md. Otherwise, the panes open a shell with
# clear instructions on how to start the agent manually.
#
# Usage:
#   scripts/run_agents.sh [session-name]
#
# Env:
#   CODEX_BIN   Optional. Name/path of Codex CLI (default: codex)
#   OPENAI_API_KEY  Required by Codex CLI (export in your shell)
#   GITHUB_TOKEN    Optional for gh integration in agent flows

SESSION_NAME=${1:-microfluidic-agents}
CODEX_BIN=${CODEX_BIN:-codex}

root_dir() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

require_tmux() {
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux is required. Install tmux and re-run:"
    echo "  brew install tmux    # macOS" 
    echo "  sudo apt-get install tmux  # Debian/Ubuntu"
    exit 1
  fi
}

codex_cmd_for_policy() {
  # Echo the command to run Codex CLI with a policy file if possible.
  local policy="$1"
  if command -v "$CODEX_BIN" >/dev/null 2>&1; then
    # Try known subcommands in order of likelihood
    if "$CODEX_BIN" --help 2>/dev/null | grep -qi "chat"; then
      echo "$CODEX_BIN chat --policy '$policy'"
      return 0
    elif "$CODEX_BIN" --help 2>/dev/null | grep -qi "agent"; then
      echo "$CODEX_BIN agent --policy '$policy'"
      return 0
    else
      # Fallback: many CLIs accept a policy file via --policy
      echo "$CODEX_BIN --policy '$policy'"
      return 0
    fi
  fi
  return 1
}

start_window() {
  local session="$1"; shift
  local win_name="$1"; shift
  local policy_file="$1"; shift

  local cmd
  if cmd=$(codex_cmd_for_policy "$policy_file"); then
    tmux new-window -t "$session" -n "$win_name" "cd '$(root_dir)'; clear; echo 'Starting $win_name with policy: $policy_file'; echo; $cmd"
  else
    tmux new-window -t "$session" -n "$win_name" "cd '$(root_dir)'; clear; cat <<'MSG'
┌──────────────────────────────────────────────────────────────┐
│ $win_name                                                    │
├──────────────────────────────────────────────────────────────┤
│ Codex CLI not found (CODEX_BIN=$CODEX_BIN).                  │
│ Install the Codex CLI, export OPENAI_API_KEY, then run:      │
│                                                              │
│   codex chat --policy $policy_file                           │
│        (or) codex agent --policy $policy_file                │
│                                                              │
│ Repository root: $(root_dir)                                 │
└──────────────────────────────────────────────────────────────┘
MSG
    exec bash"
  fi
}

main() {
  require_tmux

  local root
  root=$(root_dir)
  mkdir -p "$root/.ai/policies"

  # Ensure policy files exist (created by repo or on first run by this script)
  [ -f "$root/.ai/policies/orchestrator.md" ] || cat > "$root/.ai/policies/orchestrator.md" << 'POL'
# Orchestrator — Product & Planning
Role: Define the smallest useful increments toward the MVP, based on High-Level-Requirements.md and STATUS.md. Produce clear tasks with acceptance criteria, and question scope when needed.

Inputs:
- High-Level-Requirements.md (source of truth for product scope)
- STATUS.md (what works, gaps, action items)
- AGENTS.md (conventions)

Operating Loop:
1) Pick/clarify a high-impact slice (e.g., job UX, geometry import, viewer).
2) Write a short plan with 1–3 tasks, each with acceptance criteria expressed as tests (pytest/Playwright) and docs updates.
3) Create or update issues (gh if available) and assign to Developer.
4) When PRs arrive, coordinate with Reviewer/Tester to gate on CI and requirements.
5) Update STATUS.md succinctly.

Constraints:
- Keep tasks small (1–2 PRs) and test-first.
- Challenge ambiguity early; stick to MVP.
- No secrets; no network in tests.

Hand-offs:
- To Developer: task description, acceptance criteria, files to touch, and test plan.
- To Reviewer/Tester: intended behavior and checks to perform.
POL

  [ -f "$root/.ai/policies/developer.md" ] || cat > "$root/.ai/policies/developer.md" << 'PD'
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
PD

  [ -f "$root/.ai/policies/reviewer.md" ] || cat > "$root/.ai/policies/reviewer.md" << 'PR'
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
PR

  # Start tmux session with three windows
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Re-attaching to existing tmux session: $SESSION_NAME"
    exec tmux attach -t "$SESSION_NAME"
  fi

  tmux new-session -d -s "$SESSION_NAME" -n orchestrator "cd '$(root_dir)'; clear; echo 'Preparing orchestrator...' && sleep 0.2"
  start_window "$SESSION_NAME" developer    "$root/.ai/policies/developer.md"
  start_window "$SESSION_NAME" reviewer     "$root/.ai/policies/reviewer.md"

  # Replace the first (orchestrator) window with actual command
  tmux kill-window -t "$SESSION_NAME:orchestrator" 2>/dev/null || true
  tmux new-window -t "$SESSION_NAME" -n orchestrator "cd '$(root_dir)'; clear; echo 'Repository: $(basename "$(root_dir)")'; echo; echo 'Policy: .ai/policies/orchestrator.md'; echo; if cmd=\$(codex_cmd_for_policy "$root/.ai/policies/orchestrator.md"); then eval \"\$cmd\"; else cat <<'MSG'; echo; echo 'Start your agent manually here when ready.'; echo; exec bash; fi
MSG
  
  tmux select-window -t "$SESSION_NAME:orchestrator"
  exec tmux attach -t "$SESSION_NAME"
}

main "$@"

