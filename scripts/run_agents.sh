#!/usr/bin/env bash
set -euo pipefail

# Spawns three agent shells (orchestrator, developer, reviewer) using tmux.
# Each pane starts the Codex CLI with a matching policy if available,
# otherwise prints instructions to start it manually.
#
# Usage:
#   scripts/run_agents.sh [session-name]
#
# Env:
#   CODEX_BIN         Optional. Codex CLI executable name/path (default: codex)
#   OPENAI_API_KEY    Required for Codex CLI

SESSION_NAME=${1:-microfluidic-agents}
CODEX_BIN=${CODEX_BIN:-codex}
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

require_tmux() {
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux is required. Install tmux and re-run:"
    echo "  brew install tmux    # macOS"
    echo "  sudo apt-get install tmux  # Debian/Ubuntu"
    exit 1
  fi
}

codex_cmd_for_policy() {
  # Prints the codex command to run with the given policy file, if codex exists.
  local policy_file="$1"
  if command -v "$CODEX_BIN" >/dev/null 2>&1; then
    if "$CODEX_BIN" --help 2>/dev/null | grep -qi "chat"; then
      printf "%s\n" "$CODEX_BIN chat --policy '$policy_file'"
      return 0
    elif "$CODEX_BIN" --help 2>/dev/null | grep -qi "agent"; then
      printf "%s\n" "$CODEX_BIN agent --policy '$policy_file'"
      return 0
    else
      printf "%s\n" "$CODEX_BIN --policy '$policy_file'"
      return 0
    fi
  fi
  return 1
}

open_window() {
  # open_window <session> <name> <policy_path>
  local session="$1"; shift
  local name="$1"; shift
  local policy="$1"; shift

  tmux new-window -t "$session" -n "$name"
  tmux send-keys -t "$session:$name" "cd '$ROOT_DIR'" C-m "clear" C-m

  if command -v "$CODEX_BIN" >/dev/null 2>&1; then
    tmux send-keys -t "$session:$name" "CODEX_BIN='$CODEX_BIN' scripts/run_codex_with_policy.sh '$policy'" C-m
  else
    tmux send-keys -t "$session:$name" "echo 'Codex CLI not found (CODEX_BIN=$CODEX_BIN).'; echo 'Install Codex CLI and run:'; echo '  codex chat --policy $policy'" C-m
  fi
}

main() {
  require_tmux

  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Re-attaching to existing tmux session: $SESSION_NAME"
    exec tmux attach -t "$SESSION_NAME"
  fi

  # First window is orchestrator
  tmux new-session -d -s "$SESSION_NAME" -n orchestrator
  tmux send-keys -t "$SESSION_NAME:orchestrator" "cd '$ROOT_DIR'" C-m "clear" C-m
  if command -v "$CODEX_BIN" >/dev/null 2>&1; then
    tmux send-keys -t "$SESSION_NAME:orchestrator" "CODEX_BIN='$CODEX_BIN' scripts/run_codex_with_policy.sh '$ROOT_DIR/.ai/policies/orchestrator.md'" C-m
  else
    tmux send-keys -t "$SESSION_NAME:orchestrator" "echo 'Codex CLI not found (CODEX_BIN=$CODEX_BIN).'; echo 'Install Codex CLI and run:'; echo '  codex chat --policy .ai/policies/orchestrator.md'" C-m
  fi

  # Other windows
  open_window "$SESSION_NAME" developer  "$ROOT_DIR/.ai/policies/developer.md"
  open_window "$SESSION_NAME" reviewer   "$ROOT_DIR/.ai/policies/reviewer.md"

  tmux select-window -t "$SESSION_NAME:orchestrator"
  exec tmux attach -t "$SESSION_NAME"
}

main "$@"
