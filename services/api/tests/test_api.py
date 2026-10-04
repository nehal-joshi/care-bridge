"""API tests against a scratch database. Gemma and Laya are not required: their fallbacks are exercised."""
import os
import tempfile

os.environ["CAREBRIDGE_DB"] = os.path.join(tempfile.mkdtemp(), "test.sqlite3")
os.environ["LAYA_URL"] = "http://127.0.0.1:9"  # nothing listens here, so Laya fallbacks run
os.environ["OLLAMA_URL"] = "http://127.0.0.1:9"  # keep tests offline and deterministic

from fastapi.testclient import TestClient  # noqa: E402

from app.config import INTERNAL_SECRET  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app, client=("127.0.0.1", 50000))
PRIYA = {"X-Dev-User": "priya"}
MARCUS = {"X-Dev-User": "marcus"}


def test_me_and_roles():
    me = client.get("/api/me", headers=PRIYA).json()
    assert me["member"]["role"] == "primary"
    assert me["person"]["name"] == "Ruth Alvarez"
    assert client.get("/api/me").status_code == 401


def test_brief_orders_warning_signs_first():
    brief = client.get("/api/brief", headers=MARCUS).json()
    tiers = [i["fact"]["tier"] for i in brief["items"]]
    assert brief["items"] and tiers[0] == "warning"
    assert len(brief["items"]) <= 5


def test_review_schedules_with_fsrs():
    r = client.post("/api/reviews", json={"fact_id": "weight_rule", "rating": "good"}, headers=MARCUS).json()
    assert r["rating"] == "good" and r["state"]["is_due"] is False


def test_typed_answer_without_laya_asks_for_self_rating():
    r = client.post("/api/reviews", json={"fact_id": "walker_brakes", "answer_text": "lock the brakes"},
                    headers=MARCUS).json()
    assert r["needs_self_rating"] is True


def test_coverage_alert_on_weight_rule():
    cov = client.get("/api/coverage", headers=PRIYA).json()
    assert any(row["fact"]["id"] == "uti_confusion" for row in cov["rows"])
    assert {m["id"] for m in cov["members"]} == {"priya", "marcus", "dev"}


def test_edit_shows_as_changed_in_next_brief():
    client.patch("/api/facts/evening_meds", json={"text": "Evening pills with vanilla pudding after the 7 pm news."},
                 headers=PRIYA)
    brief = client.get("/api/brief", headers=MARCUS).json()
    first = brief["items"][0]
    assert first["changed"] and first["fact"]["id"] == "evening_meds" and "chocolate" in first["before"]
    changes = client.get("/api/changes", headers=MARCUS).json()
    assert changes[0]["type"] == "fact_changed"


def test_aide_cannot_edit():
    assert client.patch("/api/facts/tea", json={"text": "x"}, headers=MARCUS).status_code == 403


def test_internal_endpoints_need_secret():
    assert client.post("/api/internal/context", json={"sender_id": "1", "message": "hi"}).status_code == 403


def test_ruth_context_filters_caregiver_only_facts():
    from app.main import conn
    conn.execute("UPDATE members SET telegram_id = 4242 WHERE id = 'ruth'")
    conn.commit()
    h = {"X-Internal-Secret": INTERNAL_SECRET}
    ctx = client.post("/api/internal/context", json={"sender_id": "4242", "message": "my weight scale went up"},
                      headers=h).json()
    assert ctx["role"] == "older_adult"
    assert "pudding" not in ctx["context"]
    assert ctx["fact_id"] == "weight_rule"
