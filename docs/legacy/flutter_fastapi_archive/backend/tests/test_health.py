from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_routines_never_calls_ai():
    """Guards the architecture rule from docs/Architecture_Specification.md section 6."""
    response = client.post("/ai/route", json={"child_id": "test", "feature": "routines", "payload": {}})
    assert response.json()["status"] == "error"
