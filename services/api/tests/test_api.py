"""API tests against a scratch database. Gemma and Laya are not required: their fallbacks are exercised."""
import os
import tempfile

os.environ["CAREBRIDGE_DB"] = os.path.join(tempfile.mkdtemp(), "test.sqlite3")
os.environ["LAYA_URL"] = "http://127.0.0.1:9"  # nothing listens here, so Laya fallbacks run
os.environ["OLLAMA_URL"] = "http://127.0.0.1:9"  # keep tests offline and deterministic
os.environ["CAREBRIDGE_DEV_AUTH"] = "1"  # tests sign in with X-Dev-User
os.environ["CAREBRIDGE_TELEGRAM_IDS"] = ""
os.environ["TELEGRAM_BOT_TOKEN"] = ""  # never message real people from tests
os.environ["CAREBRIDGE_PUBLIC_URL"] = ""

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


def test_ruth_context_has_profile_and_circle():
    h = {"X-Internal-Secret": INTERNAL_SECRET}
    ctx = client.post("/api/internal/context", json={"sender_id": "4242", "message": "How old am I?"}, headers=h).json()
    assert "age 78" in ctx["context"] and "Priya (Daughter)" in ctx["context"]
    assert "Dr. Amara Okafor" in ctx["context"]


def test_ruth_asking_for_priya_notifies_circle_without_a_tool_call(monkeypatch):
    from app import llm
    monkeypatch.setattr(llm, "analyze_message", lambda *a, **k: {
        "fact_id": None, "asks_for_person": True, "feeling_unwell": True, "emergency": False,
        "summary": "Ruth feels unwell and wants Priya to call her."})
    h = {"X-Internal-Secret": INTERNAL_SECRET}
    ctx = client.post("/api/internal/context", json={"sender_id": "4242", "message": "I feel unwell, call Priya"},
                      headers=h).json()
    assert ctx["actions"], ctx
    types = [e["type"] for e in client.get("/api/changes", headers=PRIYA).json()[:3]]
    assert "older_adult_message" in types and "circle_notified" in types


def test_caregiver_chat_fact_becomes_a_draft(monkeypatch):
    from app import llm
    monkeypatch.setattr(llm, "analyze_message", lambda *a, **k: {
        "fact_id": None, "shares_new_care_info": True, "new_fact_text": "Ruth's reading glasses are on the hall table."})
    from app.main import conn
    conn.execute("UPDATE members SET telegram_id = 5151 WHERE id = 'marcus'")
    conn.commit()
    h = {"X-Internal-Secret": INTERNAL_SECRET}
    ctx = client.post("/api/internal/context", json={"sender_id": "5151", "message": "FYI her glasses are on the hall table"},
                      headers=h).json()
    assert "draft" in " ".join(ctx["actions"])
    drafts = [f for f in client.get("/api/facts", headers=PRIYA).json() if f["status"] == "draft"]
    assert any("reading glasses" in f["text"] for f in drafts)


def test_today_checklist_tick_and_untick():
    view = client.get("/api/today", headers=MARCUS).json()
    assert view["summary"]["total"] >= 9
    open_item = next(i for i in view["items"] if not i["log"])
    log = client.post("/api/logs", json={"schedule_id": open_item["schedule"]["id"], "status": "done"}, headers=MARCUS).json()
    assert log["status"] == "done" and log["logged_by"] == "marcus"
    after = client.get("/api/today", headers=PRIYA).json()
    assert after["summary"]["done"] == view["summary"]["done"] + 1
    client.delete(f"/api/logs/{log['id']}", headers=MARCUS)
    assert client.get("/api/today", headers=PRIYA).json()["summary"]["done"] == view["summary"]["done"]


def test_schedule_add_edit_remove_shows_in_changes():
    s = client.post("/api/schedules", json={"category": "health", "title": "Blood pressure check", "time": "14:00",
                                            "details": "Write it on the fridge sheet"}, headers=PRIYA).json()
    client.patch(f"/api/schedules/{s['id']}", json={"time": "14:30"}, headers=MARCUS)
    client.delete(f"/api/schedules/{s['id']}", headers=MARCUS)
    types = [e["type"] for e in client.get("/api/changes", headers=PRIYA).json()[:3]]
    assert types[:3] == ["schedule_removed", "schedule_changed", "schedule_added"]
    assert client.post("/api/schedules", json={"category": "food", "title": "x", "time": "25:00"}, headers=PRIYA).status_code == 400


def test_one_off_entry_and_refusal():
    e = client.post("/api/logs", json={"category": "health", "title": "Weight", "note": "164.0 lb"}, headers=MARCUS).json()
    assert e["schedule_id"] is None
    client.delete(f"/api/logs/{e['id']}", headers=MARCUS)


def test_reports_pdf_csv_and_signed_link():
    link = client.post("/api/reports/link", json={"period": "week", "format": "pdf"}, headers=PRIYA).json()
    pdf = client.get(link["path"])
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    link = client.post("/api/reports/link", json={"period": "month", "format": "csv"}, headers=PRIYA).json()
    csv_text = client.get(link["path"]).text
    assert csv_text.startswith("date,time,category,item") and "Furosemide" in csv_text
    assert client.get(link["path"].replace("sig=", "sig=0")).status_code == 403
    assert client.post("/api/reports/link", json={"period": "week"}, headers=MARCUS).status_code == 403
