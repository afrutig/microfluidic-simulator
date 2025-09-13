#!/usr/bin/env bash
set -euo pipefail

# Launch three agents in macOS Terminal tabs (no tmux).
# Each tab runs the Codex CLI fed by a policy over stdin by default.
#
# Usage:
#   scripts/run_agents_macos_terminal.sh
#
# Env (optional):
#   CODEX_BIN         Codex CLI binary (default: codex)
#   CODEX_TRY_FLAGS   0 to avoid flags entirely (default: 0 here)
#   CODEX_PIPE_TARGET Command to pipe policy into (default: "codex")

if ! command -v osascript >/dev/null 2>&1; then
  echo "This launcher requires macOS (osascript not found)." >&2
  exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CODEX_BIN=${CODEX_BIN:-codex}
CODEX_TRY_FLAGS=${CODEX_TRY_FLAGS:-0}
CODEX_PIPE_TARGET=${CODEX_PIPE_TARGET:-$CODEX_BIN}

ORCH="$ROOT_DIR/.ai/policies/orchestrator.md"
DEVL="$ROOT_DIR/.ai/policies/developer.md"
REVR="$ROOT_DIR/.ai/policies/reviewer.md"

if [ ! -f "$ORCH" ] || [ ! -f "$DEVL" ] || [ ! -f "$REVR" ]; then
  echo "Policy files not found under .ai/policies/." >&2
  exit 1
fi

CMD_ENV="CODEX_BIN='$CODEX_BIN' CODEX_TRY_FLAGS='$CODEX_TRY_FLAGS' CODEX_PIPE_TARGET='$CODEX_PIPE_TARGET'"

osascript <<OSA
tell application "Terminal"
  activate
  do script "cd '$ROOT_DIR'; $CMD_ENV scripts/run_codex_with_policy.sh '$ORCH'"
  delay 0.25
  do script "cd '$ROOT_DIR'; $CMD_ENV scripts/run_codex_with_policy.sh '$DEVL'" in front window
  delay 0.25
  do script "cd '$ROOT_DIR'; $CMD_ENV scripts/run_codex_with_policy.sh '$REVR'" in front window
end tell
OSA

echo "Opened Terminal with 3 tabs (orchestrator, developer, reviewer)."
echo "If nothing appears, open Terminal.app and check the tabs."

