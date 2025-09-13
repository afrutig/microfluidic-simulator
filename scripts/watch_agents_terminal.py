#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / ".ai" / "agents" / "terminal_watch.json"


def run_osascript(script: str) -> str:
    p = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if p.returncode != 0:
        return f"ERROR: {p.stderr.strip()}"
    return p.stdout


def list_windows_tabs() -> List[Tuple[int, int, str]]:
    """Return list of (window_index, tab_index, last_line_snippet)."""
    out: List[Tuple[int, int, str]] = []
    # Count windows
    s_count = 'tell application "Terminal" to count windows'
    nwin_s = run_osascript(s_count).strip()
    try:
        nwin = int(nwin_s)
    except Exception:
        return out
    for w in range(1, nwin + 1):
        s_ntabs = f'tell application "Terminal" to count tabs of window {w}'
        ntabs_s = run_osascript(s_ntabs).strip()
        try:
            ntabs = int(ntabs_s)
        except Exception:
            continue
        for t in range(1, ntabs + 1):
            s_contents = (
                f'tell application "Terminal" to try\n'
                f'  set theText to contents of tab {t} of window {w}\n'
                f'  return theText\n'
                f'on error errMsg\n'
                f'  return "ERROR:" & errMsg\n'
                f'end try'
            )
            txt = run_osascript(s_contents)
            last = txt.splitlines()[-1] if txt else ""
            snippet = last[-120:]
            out.append((w, t, snippet))
    return out


def write_default_config() -> None:
    windows = list_windows_tabs()
    cfg_dir = CONFIG.parent
    cfg_dir.mkdir(parents=True, exist_ok=True)
    default = {
        "poll_seconds": 2,
        "agents": [
            {
                "name": "orchestrator",
                "window": windows[0][0] if windows else 1,
                "tab": windows[0][1] if windows else 1,
                "markers": ["User:", "You:", "Awaiting", "> ", ">> "],
            },
            {
                "name": "developer",
                "window": windows[1][0] if len(windows) > 1 else 1,
                "tab": windows[1][1] if len(windows) > 1 else 1,
                "markers": ["User:", "You:", "Awaiting", "> ", ">> "],
            },
            {
                "name": "reviewer",
                "window": windows[2][0] if len(windows) > 2 else 1,
                "tab": windows[2][1] if len(windows) > 2 else 1,
                "markers": ["User:", "You:", "Awaiting", "> ", ">> "],
            },
        ],
        "notes": "Adjust window/tab to match the Terminal tabs for each agent."
    }
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(default, f, indent=2)
    # Also print mapping hints
    print("Created default config:", CONFIG)
    print("Current Terminal windows/tabs (use these to edit the config):")
    for w, t, sn in windows:
        print(f"- window {w}, tab {t}, last: {sn!r}")


def get_last_line(window: int, tab: int) -> str:
    s_contents = (
        f'tell application "Terminal" to try\n'
        f'  set theText to contents of tab {tab} of window {window}\n'
        f'  return theText\n'
        f'on error errMsg\n'
        f'  return "ERROR:" & errMsg\n'
        f'end try'
    )
    txt = run_osascript(s_contents)
    return (txt.splitlines()[-1] if txt else "").strip()


def main() -> None:
    if sys.platform != "darwin":
        print("This watcher works with macOS Terminal only.")
        sys.exit(1)

    if not CONFIG.exists():
        write_default_config()
        print("Edit the config to point to the correct window/tab for each agent.")
        sys.exit(0)

    cfg: Dict[str, Any] = json.loads(CONFIG.read_text(encoding="utf-8"))
    poll = int(cfg.get("poll_seconds", 2))
    agents = cfg.get("agents", [])
    if not agents:
        print("No agents configured in", CONFIG)
        sys.exit(1)

    print("Watching Terminal tabs. Ctrl-C to stop.")
    while True:
        try:
            statuses = []
            for a in agents:
                name = a.get("name")
                window = int(a.get("window", 1))
                tab = int(a.get("tab", 1))
                markers: List[str] = list(a.get("markers", []))
                last = get_last_line(window, tab)
                needs = any(m in last for m in markers)
                statuses.append((name, needs, last))
            # Clear screen-like output
            print("\033[2J\033[H", end="")
            print("Agent Prompt Watcher (macOS Terminal)\n")
            for name, needs, last in statuses:
                flag = "NEEDS PROMPT" if needs else "..."
                print(f"- {name:<12} {flag:<14} last: {last}")
            time.sleep(poll)
        except KeyboardInterrupt:
            print("\nStopped.")
            break


if __name__ == "__main__":
    main()

