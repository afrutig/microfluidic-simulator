#!/usr/bin/env bash
set -euo pipefail

# Run Codex CLI with a given policy file, trying several common flag patterns.
# Falls back to piping the policy to stdin if flags are unsupported.
#
# Usage:
#   scripts/run_codex_with_policy.sh path/to/policy.md
#
# Env overrides:
#   CODEX_BIN           Codex CLI executable (default: codex)
#   CODEX_SUBCOMMAND    Preferred subcommand (e.g., chat, agent, or empty)
#   CODEX_POLICY_FLAG   Policy flag (e.g., --policy, --prompt-file, -p, or 'stdin')
#   CODEX_LAUNCH_CMD    Full custom command string; '{policy}' will be replaced

POLICY=${1:?"usage: $0 POLICY_FILE"}
CODEX_BIN=${CODEX_BIN:-codex}
CODEX_SUBCOMMAND=${CODEX_SUBCOMMAND:-}
CODEX_POLICY_FLAG=${CODEX_POLICY_FLAG:-}
CODEX_LAUNCH_CMD=${CODEX_LAUNCH_CMD:-}

if ! command -v "$CODEX_BIN" >/dev/null 2>&1; then
  echo "Codex CLI not found (CODEX_BIN=$CODEX_BIN)."
  echo "Install Codex CLI and try again."
  exit 127
fi

if [ -n "$CODEX_LAUNCH_CMD" ]; then
  eval "${CODEX_LAUNCH_CMD//\{policy\}/$POLICY}"
  exit $?
fi

# Build candidate launch commands. Prefer stdin first to avoid flag issues.
declare -a CANDIDATES=()

if [ -n "$CODEX_LAUNCH_CMD" ]; then
  CANDIDATES+=("${CODEX_LAUNCH_CMD//\{policy\}/$POLICY}")
fi

if [ -n "$CODEX_SUBCOMMAND" ] && [ -n "$CODEX_POLICY_FLAG" ]; then
  CANDIDATES+=("$CODEX_BIN $CODEX_SUBCOMMAND $CODEX_POLICY_FLAG '$POLICY'")
fi

# Stdin first (more tolerant)
CANDIDATES+=(
  "cat '$POLICY' | $CODEX_BIN chat"
  "cat '$POLICY' | $CODEX_BIN agent"
  "cat '$POLICY' | $CODEX_BIN"
  "$CODEX_BIN chat --policy '$POLICY'"
  "$CODEX_BIN agent --policy '$POLICY'"
  "$CODEX_BIN --policy '$POLICY'"
  "$CODEX_BIN chat --prompt-file '$POLICY'"
  "$CODEX_BIN agent --prompt-file '$POLICY'"
  "$CODEX_BIN --prompt-file '$POLICY'"
  "$CODEX_BIN chat -p '$POLICY'"
  "$CODEX_BIN agent -p '$POLICY'"
  "$CODEX_BIN -p '$POLICY'"
)

for cmd in "${CANDIDATES[@]}"; do
  echo "Launching: $cmd"
  # Use bash -lc to support pipes and quotes
  bash -lc "$cmd"
  ec=$?
  # If the process is interactive it won't return here; for quick exits, try next
  if [ $ec -eq 0 ] || [ $ec -eq 130 ] || [ $ec -eq 143 ]; then
    exit 0
  fi
  # Brief pause between attempts to keep logs readable
  sleep 0.3
done

echo "All launch patterns failed. Consider setting CODEX_LAUNCH_CMD='codex <cmd> --flag {policy}'"
exit 1
