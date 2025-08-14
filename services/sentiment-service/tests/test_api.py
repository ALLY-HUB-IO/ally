from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_score_missing_text():
    r = client.post("/score", json={})
    # Before startup event runs in this test context, models may not be loaded.
    # We only check that API returns a client error (400 or 503).
    assert r.status_code in (400, 503)


