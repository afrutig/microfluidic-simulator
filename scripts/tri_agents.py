#!/usr/bin/env python3
"""
Simple tri-agent runner without tmux or external CLIs.

Runs three roles in a loop using the OpenAI API:
  - Orchestrator (product planning)
  - Developer (implementation)
  - Reviewer (review & tests)

Requirements:
  pip install openai
  export OPENAI_API_KEY=...

Usage:
  python scripts/tri_agents.py [--rounds 3] [--model gpt-4o-mini]

Notes:
  - Reads role prompts from .ai/policies/*.md
  - Writes a timestamped log to logs/tri-agents-YYYYmmdd-HHMMSS.md
  - Stops early if the Orchestrator output contains a sentinel like: DONE
"""
from __future__ import annotations

import argparse
import datetime as _dt
import os
from pathlib import Path
from typing import List, Dict

try:
    from openai import OpenAI  # type: ignore
except Exception:
    print("Missing dependency: openai. Install with: pip install openai")
    raise


ROOT = Path(__file__).resolve().parents[1]
POLICIES = ROOT / ".ai" / "policies"
LOGS_DIR = ROOT / "logs"


def read_policy(name: str) -> str:
    path = POLICIES / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"Policy not found: {path}")
    return path.read_text(encoding="utf-8")


def call_chat(client: OpenAI, model: str, system: str, messages: List[Dict[str, str]]) -> str:
    msgs = [{"role": "system", "content": system}] + messages
    resp = client.chat.completions.create(model=model, messages=msgs)
    return (resp.choices[0].message.content or "").strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=3, help="Max rounds of Orchestrator→Developer→Reviewer")
    ap.add_argument("--model", default=os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    args = ap.parse_args()

    orchestrator_sys = read_policy("orchestrator")
    developer_sys = read_policy("developer")
    reviewer_sys = read_policy("reviewer")

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts = _dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    log_path = LOGS_DIR / f"tri-agents-{ts}.md"

    client = OpenAI()

    convo_o: List[Dict[str, str]] = [
        {"role": "user", "content": (
            "Context: You are working in a Microfluidic Simulator repo. "
            "Use High-Level-Requirements.md and STATUS.md in the repo root to plan. "
            "Produce 1–3 small tasks with acceptance criteria expressed as tests (pytest/Playwright). "
            "Stop when you propose actionable tasks for the next PR."
        )}
    ]
    convo_d: List[Dict[str, str]] = []
    convo_r: List[Dict[str, str]] = []

    with log_path.open("w", encoding="utf-8") as log:
        log.write(f"# Tri-Agents Session — {ts}\n\n")
        log.flush()

        for rnd in range(1, args.rounds + 1):
            log.write(f"## Round {rnd}\n\n")

            # Orchestrator
            o_out = call_chat(client, args.model, orchestrator_sys, convo_o)
            log.write("### Orchestrator\n\n")
            log.write(o_out + "\n\n")
            log.flush()
            if "DONE" in o_out.upper():
                break

            # Developer gets orchestrator plan
            convo_d.append({"role": "user", "content": (
                "Orchestrator plan:\n\n" + o_out + "\n\n" +
                "Implement minimal changes to satisfy the plan. "
                "Output: a short patch plan, file paths, and the exact test commands to run."
            )})
            d_out = call_chat(client, args.model, developer_sys, convo_d)
            log.write("### Developer\n\n")
            log.write(d_out + "\n\n")
            log.flush()

            # Reviewer gets both
            convo_r.append({"role": "user", "content": (
                "Orchestrator plan:\n\n" + o_out + "\n\n" +
                "Developer proposal:\n\n" + d_out + "\n\n" +
                "Review for correctness vs requirements, list the tests to run, and call out risks."
            )})
            r_out = call_chat(client, args.model, reviewer_sys, convo_r)
            log.write("### Reviewer\n\n")
            log.write(r_out + "\n\n")
            log.flush()

        print(f"Session log written to: {log_path}")


if __name__ == "__main__":
    main()

