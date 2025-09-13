# Justfile tasks to run the app end-to-end with one command

set shell := ["bash", "-cu"]

default:
    @just up

gen-openapi:
    # Generate OpenAPI JSON using a disposable Python container
    docker run --rm -v "$PWD":/app -w /app python:3.11-slim \
        sh -c "pip install --no-cache-dir fastapi pydantic uvicorn redis rq python-multipart numpy && python scripts/generate_openapi.py api/openapi.json"

gen-ts:
    # Generate TypeScript client from local OpenAPI file
    docker run --rm -v "$PWD/frontend":/app -v "$PWD/api":/spec -w /app node:20-alpine \
        sh -c "npm i -g openapi-typescript && openapi-typescript /spec/openapi.json -o src/api/generated.ts"

up: gen-openapi
    # Build and run containers (prod-like, detached)
    cd infra && docker compose up -d --build

up-fresh: gen-openapi
    # Fresh rebuild of all images without cache and start services
    cd infra && docker compose build --no-cache api worker frontend
    cd infra && docker compose up -d redis
    cd infra && docker compose up -d api frontend worker

dev: gen-openapi gen-ts
    # Run dev profile with hot reload and proxy (detached)
    cd infra && docker compose --profile dev up -d --build frontend-dev api redis

lint:
    # Run all linters/type-checkers and aggregate status without early exit
    set +e
    FAIL=0
    # Backend: Ruff (lint incl. import order)
    if docker run --rm -v "$PWD":/work -w /work python:3.11-slim \
        sh -c "pip install --no-cache-dir ruff && ruff check api"; then :; else FAIL=1; fi
    # Backend: mypy (types)
    if docker run --rm -v "$PWD":/work -w /work python:3.11-slim \
        sh -c "pip install --no-cache-dir mypy && mypy --ignore-missing-imports --install-types --non-interactive api"; then :; else FAIL=1; fi
    # Frontend: Prettier (format check)
    if docker run --rm -v "$PWD/frontend":/app -w /app node:20-alpine \
        sh -c "npm i -g prettier && prettier --check \"**/*.{ts,tsx,js,json,css,md}\""; then :; else FAIL=1; fi
    # Frontend: ESLint (rules + a11y + import sorting)
    if docker run --rm -v "$PWD/frontend":/app -w /app node:20-alpine \
        sh -c "npm i -g eslint@8 @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-plugin-import eslint-plugin-simple-import-sort eslint-config-prettier && \
               export NODE_PATH=\$(npm root -g) && \
               eslint -c .eslintrc.cjs \"src/**/*.{ts,tsx}\""; then :; else FAIL=1; fi
    # Frontend: TypeScript type-check
    if docker run --rm -v "$PWD/frontend":/app -w /app node:20-alpine \
        sh -c "npm i -g typescript && tsc --noEmit"; then :; else FAIL=1; fi
    exit ${FAIL:-0}

lint-fix:
    # Auto-fix formatting and simple lint issues
    # Backend: Ruff format and autofix
    docker run --rm -v "$PWD":/work -w /work python:3.11-slim \
        sh -c "pip install --no-cache-dir ruff && ruff format api && ruff check api --fix"
    # Frontend: Prettier write + ESLint fix
    docker run --rm -v "$PWD/frontend":/app -w /app node:20-alpine \
        sh -c "npm i -g prettier eslint@8 @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-plugin-import eslint-plugin-simple-import-sort eslint-config-prettier && \
               export NODE_PATH=\$(npm root -g) && \
               prettier --write \"**/*.{ts,tsx,js,json,css,md}\" && \
               eslint -c .eslintrc.cjs \"src/**/*.{ts,tsx}\" --fix"
