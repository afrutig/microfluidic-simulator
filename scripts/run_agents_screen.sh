#!/usr/bin/env bash
set -euo pipefail

# Launch three agents in a GNU screen session (no tmux).
# Each window runs the Codex CLI fed by a policy over stdin by default.
#
# Usage:
#   scripts/run_agents_screen.sh [session-name]

SESSION=${1:-microfluidic-agents}
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CODEX_BIN=${CODEX_BIN:-codex}
CODEX_TRY_FLAGS=${CODEX_TRY_FLAGS:-0}
CODEX_PIPE_TARGET=${CODEX_PIPE_TARGET:-$CODEX_BIN}

if ! command -v screen >/dev/null 2>&1; then
  echo "GNU screen not found. Install it (brew install screen / apt-get install screen) or use the macOS Terminal script." >&2
  exit 1
fi

ORCH="$ROOT_DIR/.ai/policies/orchestrator.md"
DEVL="$ROOT_DIR/.ai/policies/developer.md"
REVR="$ROOT_DIR/.ai/policies/reviewer.md"

CMD="cd '$ROOT_DIR'; CODEX_BIN='$CODEX_BIN' CODEX_TRY_FLAGS='$CODEX_TRY_FLAGS' CODEX_PIPE_TARGET='$CODEX_PIPE_TARGET' scripts/run_codex_with_policy.sh"

# Start detached session with first window
screen -dmS "$SESSION" bash -lc "$CMD '$ORCH'"

# Add windows
screen -S "$SESSION" -X screen bash -lc "$CMD '$DEVL'"
screen -S "$SESSION" -X screen bash -lc "$CMD '$REVR'"

echo "Started GNU screen session: $SESSION"
echo "Attach with: screen -r $SESSION"

