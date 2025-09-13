PY?=python

.PHONY: help install api dev worker test lint typecheck run agents agents-macos agents-screen

help:
	@echo "Targets: install, api, worker, test, lint, typecheck, run"

install:
	$(PY) -m pip install -U pip
	$(PY) -m pip install -e api/[dev]

api:
	uvicorn api.app.main:app --reload

worker:
	$(PY) workers/worker.py

test:
	pytest -q api

lint:
	ruff check api

typecheck:
	mypy api

run: install api

agents:
	bash scripts/run_agents.sh

agents-macos:
	bash scripts/run_agents_macos_terminal.sh

agents-screen:
	bash scripts/run_agents_screen.sh
