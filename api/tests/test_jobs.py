from api.app.main import app
from fastapi.testclient import TestClient


def test_create_job_inline():
    client = TestClient(app)
    payload = {
        "name": "test",
        "geometry": {"width": 0.001, "height": 0.0001},
        "material": {"density": 1000, "viscosity": 0.001, "diffusivity": 1e-9},
        "boundaries": [
            {"type": "inlet", "value": 0.001},
            {"type": "outlet", "value": 0},
            {"type": "wall"},
        ],
        "solve_transport": True,
    }
    resp = client.post("/api/v1/jobs", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data and data["status"] in {"queued", "finished"}
