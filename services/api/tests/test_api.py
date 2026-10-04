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


FAKE_CBC = {"is_health_record": True, "record_type": "Complete blood count (CBC)", "patient_name": "Ruth Alvarez",
            "date": "06 Oct 2026", "source": "Maplewood Community Hospital", "ordered_by": "Dr. Amara Okafor",
            "summary": "Hemoglobin is low.",
            "findings": [{"name": "Hemoglobin", "value": "10.8", "unit": "g/dL", "reference_range": "12.0-15.5", "flag": "low"},
                         {"name": "Platelet count", "value": "196", "unit": "10^3/uL", "reference_range": "150-400", "flag": "normal"}]}
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_photo_in_chat_becomes_a_record(monkeypatch, tmp_path):
    from app import llm, main
    monkeypatch.setattr(llm, "read_health_record", lambda *a, **k: FAKE_CBC)
    monkeypatch.setattr(main, "HERMES_IMAGE_DIRS", [tmp_path])
    img = tmp_path / "cbc.png"
    img.write_bytes(PNG)
    outside = tmp_path.parent / "secret.png"
    outside.write_bytes(PNG + b"x")
    main.conn.execute("UPDATE members SET telegram_id = 1111 WHERE id = 'priya'")
    main.conn.commit()
    h = {"X-Internal-Secret": INTERNAL_SECRET}
    r = client.post("/api/internal/image", json={"sender_id": "1111", "paths": [str(img), str(outside)]}, headers=h).json()
    assert [x["status"] for x in r["results"]] == ["saved"]  # the file outside Hermes's image cache is ignored
    again = client.post("/api/internal/image", json={"sender_id": "1111", "paths": [str(img)]}, headers=h).json()
    assert again["results"][0]["status"] == "already_saved"
    records = client.get("/api/records", headers=MARCUS).json()
    assert records[0]["flagged"][0]["name"] == "Hemoglobin"
    ctx = client.post("/api/internal/context", json={"sender_id": "1111", "message": ""}, headers=h).json()["context"]
    assert "Hemoglobin 10.8 g/dL (low" in ctx
    ruth = client.post("/api/internal/context", json={"sender_id": "4242", "message": ""}, headers=h).json()["context"]
    assert "10.8" not in ruth and "Complete blood count (CBC) from 06 Oct 2026 is in her records" in ruth


def test_ruth_photos_are_not_saved_as_records(monkeypatch, tmp_path):
    from app import main
    monkeypatch.setattr(main, "HERMES_IMAGE_DIRS", [tmp_path])
    img = tmp_path / "x.png"
    img.write_bytes(PNG + b"ruth")
    r = client.post("/api/internal/image", json={"sender_id": "4242", "paths": [str(img)]},
                    headers={"X-Internal-Secret": INTERNAL_SECRET}).json()
    assert r["ok"] is False


def test_photo_upload_in_mini_app(monkeypatch):
    from app import llm
    monkeypatch.setattr(llm, "read_health_record", lambda *a, **k: {**FAKE_CBC, "date": "07 Oct 2026"})
    r = client.post("/api/documents", files={"file": ("cbc2.png", PNG + b"2", "image/png")}, headers=PRIYA).json()
    assert r["record_status"] == "saved" and r["record"]["record_date"] == "07 Oct 2026"


def test_ruth_gets_a_guide_without_a_tool_call(monkeypatch):
    from app import llm, main, telegram
    sent = []
    monkeypatch.setattr(telegram, "send_message", lambda chat, text, button=None, path="/": sent.append((chat, button, path)) or {"ok": True, "button": True})
    monkeypatch.setattr(llm, "analyze_message", lambda *a, **k: {
        "fact_id": "weigh_daily", "asks_for_person": False, "feeling_unwell": False, "emergency": False,
        "wants_to_be_shown": True, "summary": "Ruth asked how to weigh herself."})
    main.conn.execute("DELETE FROM events WHERE type = 'explainer_sent'")
    main.conn.commit()
    ctx = client.post("/api/internal/context", json={"sender_id": "4242", "message": "How do I weigh myself? Show me"},
                      headers={"X-Internal-Secret": INTERNAL_SECRET}).json()
    assert any(b == "Show me" and p.startswith("/explain/?id=exp_weigh_daily") for _, b, p in sent)
    assert "Show me" in " ".join(ctx["actions"])


def test_caregivers_can_list_preview_and_send_guides(monkeypatch):
    from app import telegram
    monkeypatch.setattr(telegram, "send_message", lambda *a, **k: {"ok": True, "button": True})
    guides = client.get("/api/explainers", headers=MARCUS).json()
    assert {g["fact_id"] for g in guides} >= {"weight_rule", "walker_brakes"}
    before = len([e for e in client.get("/api/changes", headers=PRIYA).json() if e["type"] == "explainer_done"])
    client.post(f"/api/explainers/{guides[0]['id']}/done", headers=MARCUS)  # a caregiver preview
    after = len([e for e in client.get("/api/changes", headers=PRIYA).json() if e["type"] == "explainer_done"])
    assert after == before
    assert client.post("/api/explainers/send/walker_brakes", headers=MARCUS).json()["ok"] is True


def test_yes_show_me_follows_up_on_the_last_topic(monkeypatch):
    from app import llm, main, telegram
    sent = []
    monkeypatch.setattr(telegram, "send_message", lambda chat, text, button=None, path="/": sent.append(path) or {"ok": True, "button": True})
    replies = iter([
        {"fact_id": "walker_brakes", "asks_for_person": False, "feeling_unwell": False, "emergency": False,
         "wants_to_be_shown": False, "summary": ""},
        {"fact_id": None, "asks_for_person": False, "feeling_unwell": False, "emergency": False,
         "wants_to_be_shown": True, "summary": ""},
    ])
    monkeypatch.setattr(llm, "analyze_message", lambda *a, **k: next(replies))
    main.conn.execute("DELETE FROM events WHERE type = 'explainer_sent'")
    main.conn.execute("INSERT INTO events (person_id, type, actor, fact_id, details, created_at) VALUES "
                      "('ruth', 'explainer_sent', 'ruth', 'walker_brakes', '{}', ?)", (main.iso(main.now()),))
    main.conn.commit()
    h = {"X-Internal-Secret": INTERNAL_SECRET}
    client.post("/api/internal/context", json={"sender_id": "4242", "message": "about my walker"}, headers=h)
    assert sent == []  # sent recently, so no repeat without being asked
    client.post("/api/internal/context", json={"sender_id": "4242", "message": "yes please show me"}, headers=h)
    assert sent and sent[0].startswith("/explain/?id=exp_walker_brakes")
