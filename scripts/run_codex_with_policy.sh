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

has_subcmd() {
  local sub=$1
  "$CODEX_BIN" --help 2>/dev/null | grep -qE "(^|[[:space:]])$sub([[:space:]]|$)" || \
  "$CODEX_BIN" "$sub" --help 2>/dev/null >/dev/null
}

flag_in_help() {
  local sub=$1 flag=$2
  if [ -n "$sub" ] && has_subcmd "$sub"; then
    "$CODEX_BIN" "$sub" --help 2>/dev/null | grep -q "$flag" && return 0
  fi
  "$CODEX_BIN" --help 2>/dev/null | grep -q "$flag"
}

run_with() {
  local sub=$1 flag=$2
  if [ "$flag" = "stdin" ]; then
    if [ -n "$sub" ] && has_subcmd "$sub"; then
      exec "$CODEX_BIN" "$sub" < "$POLICY"
    else
      exec "$CODEX_BIN" < "$POLICY"
    fi
  else
    if [ -n "$sub" ]; then
      exec "$CODEX_BIN" "$sub" "$flag" "$POLICY"
    else
      exec "$CODEX_BIN" "$flag" "$POLICY"
    fi
  fi
}

# If user specified exact combo
if [ -n "$CODEX_POLICY_FLAG" ]; then
  run_with "$CODEX_SUBCOMMAND" "$CODEX_POLICY_FLAG"
fi

# Try common combinations based on help
if has_subcmd chat && flag_in_help chat "--policy"; then run_with chat --policy; fi
if has_subcmd agent && flag_in_help agent "--policy"; then run_with agent --policy; fi
if flag_in_help "" "--policy"; then run_with "" --policy; fi

if has_subcmd chat && flag_in_help chat "--prompt-file"; then run_with chat --prompt-file; fi
if has_subcmd agent && flag_in_help agent "--prompt-file"; then run_with agent --prompt-file; fi
if flag_in_help "" "--prompt-file"; then run_with "" --prompt-file; fi

# Fallback: pipe policy to stdin
if has_subcmd chat; then run_with chat stdin; fi
run_with "" stdin

