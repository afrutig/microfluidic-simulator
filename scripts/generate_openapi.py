#!/usr/bin/env python3
import json
import sys
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.openapi.utils import get_openapi
from api.app.main import create_app


def main(out_path: str) -> None:
    app = create_app()
    schema = get_openapi(
        title=app.title,
        version=app.version,
        routes=app.routes,
    )
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(schema, indent=2))
    print(f"Wrote OpenAPI schema to {out}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "api/openapi.json"
    main(out)
