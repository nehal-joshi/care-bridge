"""Care-Bridge API: care circle, handbook, FSRS briefs, coverage, and the internal endpoints Hermes calls."""
import hashlib
import json
import logging
import re
import secrets
from datetime import timedelta
from pathlib import Path

import pdfplumber
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import laya, llm, memory, telegram
from .config import DATA_DIR, INTERNAL_SECRET, ROOT, settings
from .db import connect, iso, log_event, now, row, rows
from .seed import backfill_profile, fallback_spec, reset_and_seed

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("care-bridge")

app = FastAPI(title="Care-Bridge API")
conn = connect()
if conn.execute("SELECT COUNT(*) FROM persons").fetchone()[0] == 0:
    reset_and_seed(conn)
backfill_profile(conn)

EXTRACT_CACHE = DATA_DIR / "extract-cache"
TIER_ORDER = {"warning": 0, "routine": 1, "nice": 2}
LAYA_FACT_AT = 0.9  # use Laya's fact pick only when it is this sure; otherwise Gemma picks
LAYA_HINT_AT = 0.7  # pass Laya's intent and "unsure" hints to Gemma only above this
GRADE_TO_RATING = {"correct": "good", "partial": "hard", "incorrect": "again"}
EDITOR_ROLES = ("primary", "family")

# Scene objects each explainer template can focus on. apps/explainer draws the same ids.
TEMPLATES = {
    "weigh_in": {"scale": "bathroom scale on the floor", "display": "number display on the scale",
                 "sheet": "weight sheet on the fridge", "phone": "phone on the table"},
    "stand_safely": {"chair": "armchair", "walker": "walker in front of the chair",
                     "brakes": "the two brakes on the walker handles"},
}


# ---------- helpers ----------

def person_id() -> str:
    return conn.execute("SELECT id FROM persons LIMIT 1").fetchone()["id"]


def member_names() -> dict[str, str]:
    return {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM members")}


def get_fact(fact_id: str) -> dict:
    fact = row(conn.execute("SELECT * FROM facts WHERE id = ?", (fact_id,)).fetchone())
    if not fact:
        raise HTTPException(404, "Fact not found")
    return fact


def fact_out(f: dict, names: dict[str, str] | None = None) -> dict:
    names = names or member_names()
    out = {k: f[k] for k in ("id", "text", "question", "answer", "category", "tier", "audience", "status",
                             "source", "version", "updated_at", "explainer_template", "replaces_fact_id")}
    out["shifted"] = bool(f["shifted"])
    out["created_by"] = names.get(f["created_by"], f["created_by"])
    out["approved_by"] = names.get(f["approved_by"], f["approved_by"]) if f["approved_by"] else None
    if f["replaces_fact_id"]:
        old = row(conn.execute("SELECT text FROM facts WHERE id = ?", (f["replaces_fact_id"],)).fetchone())
        out["replaces_text"] = old["text"] if old else None
    return out


def caregivers() -> list[dict]:
    marks = ",".join("?" * len(memory.CAREGIVER_ROLES))
    return rows(conn.execute(f"SELECT * FROM members WHERE role IN ({marks}) ORDER BY rowid", memory.CAREGIVER_ROLES))


def ensure_cards(fact: dict) -> None:
    for m in caregivers():
        conn.execute(
            "INSERT OR IGNORE INTO cards (member_id, fact_id, card_json, seen_version) VALUES (?,?,?,0)",
            (m["id"], fact["id"], memory.new_card_json()),
        )


def require_editor(member: dict) -> None:
    if member["role"] not in EDITOR_ROLES:
        raise HTTPException(403, "Only Priya and family can change the handbook")


def require_primary(member: dict) -> None:
    if member["role"] != "primary":
        raise HTTPException(403, "Only the primary caregiver can do this")


# ---------- auth ----------

def current_member(
    x_telegram_init_data: str | None = Header(default=None),
    x_dev_user: str | None = Header(default=None),
) -> dict:
    if x_telegram_init_data:
        data = telegram.validate_init_data(x_telegram_init_data)
        if not data:
            raise HTTPException(401, "Telegram sign-in could not be verified")
        tg_id = int(data["user"]["id"])
        member = row(conn.execute("SELECT * FROM members WHERE telegram_id = ?", (tg_id,)).fetchone())
        if member:
            return member
        if data.get("start_param"):
            joined = join_with_code(data["start_param"], tg_id, data["user"])
            if joined:
                return joined
        raise HTTPException(403, detail={"code": "not_in_circle",
                                         "message": "Ask Priya for an invite link to Ruth's care circle."})
    if settings.dev_auth and x_dev_user:
        member = row(conn.execute("SELECT * FROM members WHERE id = ?", (x_dev_user,)).fetchone())
        if member:
            return member
    raise HTTPException(401, "Open Care-Bridge from Telegram")


def join_with_code(code: str, tg_id: int, user: dict) -> dict | None:
    with conn:
        claimed = row(conn.execute("SELECT * FROM members WHERE claim_code = ?", (code,)).fetchone())
        if claimed:
            conn.execute("UPDATE members SET telegram_id = ? WHERE id = ?", (tg_id, claimed["id"]))
            log_event(conn, claimed["person_id"], "member_joined", claimed["id"], None,
                      {"summary": f"{claimed['name']} connected their Telegram account."})
            return row(conn.execute("SELECT * FROM members WHERE id = ?", (claimed["id"],)).fetchone())
        invite = row(conn.execute("SELECT * FROM invites WHERE code = ? AND used_by IS NULL", (code,)).fetchone())
        if not invite:
            return None
        member_id = f"m_{secrets.token_hex(4)}"
        name = user.get("first_name") or "Caregiver"
        conn.execute(
            "INSERT INTO members (id, person_id, name, role, relation, telegram_id) VALUES (?,?,?,?,?,?)",
            (member_id, invite["person_id"], name, invite["role"], invite["role"].title(), tg_id),
        )
        conn.execute("UPDATE invites SET used_by = ? WHERE code = ?", (member_id, code))
        for f in rows(conn.execute("SELECT * FROM facts WHERE status = 'approved'")):
            ensure_cards(f)
        log_event(conn, invite["person_id"], "member_joined", member_id, None,
                  {"summary": f"{name} joined as {invite['role']}."})
        return row(conn.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone())


def internal_only(request: Request, x_internal_secret: str | None = Header(default=None)) -> None:
    client = request.client.host if request.client else ""
    if client not in ("127.0.0.1", "::1", "localhost") or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(403, "Internal endpoint")


# ---------- circle ----------

@app.get("/api/health")
def health():
    return {"ok": True, "ollama": llm.reachable(), "model": settings.model,
            "public_url": settings.public_url or None, "dev_auth": settings.dev_auth}


@app.get("/api/me")
def me(member: dict = Depends(current_member)):
    p = row(conn.execute("SELECT * FROM persons LIMIT 1").fetchone())
    p["conditions"] = json.loads(p["conditions"])
    p["contacts"] = json.loads(p["contacts"])
    circle = [{"id": m["id"], "name": m["name"], "role": m["role"], "relation": m["relation"],
               "connected": m["telegram_id"] is not None}
              for m in rows(conn.execute("SELECT * FROM members ORDER BY rowid"))]
    drafts = conn.execute("SELECT COUNT(*) FROM facts WHERE status = 'draft'").fetchone()[0]
    return {"member": {"id": member["id"], "name": member["name"], "role": member["role"]},
            "person": p, "circle": circle, "drafts": drafts if member["role"] == "primary" else 0,
            "bot_username": settings.bot_username}


@app.get("/api/claim-links")
def claim_links(member: dict = Depends(current_member)):
    require_primary(member)
    return [{"id": m["id"], "name": m["name"], "role": m["role"], "connected": m["telegram_id"] is not None,
             "telegram_id": m["telegram_id"],
             "link": f"https://t.me/{settings.bot_username}?startapp={m['claim_code']}"}
            for m in rows(conn.execute("SELECT * FROM members ORDER BY rowid")) if m["id"] != member["id"]]


class InviteIn(BaseModel):
    role: str = "aide"


@app.post("/api/invites")
def create_invite(body: InviteIn, member: dict = Depends(current_member)):
    require_primary(member)
    if body.role not in ("family", "aide"):
        raise HTTPException(400, "Role must be family or aide")
    code = f"inv_{secrets.token_hex(4)}"
    with conn:
        conn.execute("INSERT INTO invites (code, person_id, role, created_by, created_at) VALUES (?,?,?,?,?)",
                     (code, member["person_id"], body.role, member["id"], iso(now())))
    return {"code": code, "link": f"https://t.me/{settings.bot_username}?startapp={code}"}


# ---------- handbook ----------

@app.get("/api/facts")
def list_facts(q: str = "", category: str = "", member: dict = Depends(current_member)):
    names = member_names()
    sql = "SELECT * FROM facts WHERE status = 'approved'"
    if member["role"] == "primary":
        sql = "SELECT * FROM facts WHERE status IN ('approved', 'draft')"
    facts = rows(conn.execute(sql + " ORDER BY updated_at DESC"))
    if member["role"] == "older_adult":
        facts = [f for f in facts if f["audience"] == "everyone"]
    if category:
        facts = [f for f in facts if f["category"] == category]
    if q:
        needle = q.lower()
        facts = [f for f in facts if needle in f"{f['text']} {f['question']} {f['answer']} {f['source']}".lower()]
    return [fact_out(f, names) for f in facts]


class FactIn(BaseModel):
    text: str
    category: str | None = None
    tier: str | None = None
    audience: str | None = None


@app.post("/api/facts")
def add_fact(body: FactIn, member: dict = Depends(current_member)):
    """B1: a caregiver types a fact; Gemma drafts the card; it stays a draft until Priya approves it."""
    require_editor(member)
    text = body.text.strip()
    if len(text) < 5:
        raise HTTPException(400, "Write the fact in a sentence")
    try:
        draft = llm.draft_card(text)
    except Exception as exc:  # model down or invalid JSON: keep the caregiver's words, ask them to fill the rest
        log.warning("draft_card failed: %s", exc)
        draft = {"text": text, "question": "", "answer": "", "category": "routines", "tier": "routine",
                 "audience": "caregivers"}
    for key in ("category", "tier", "audience"):
        if getattr(body, key):
            draft[key] = getattr(body, key)
    fact_id = f"f_{secrets.token_hex(4)}"
    t = iso(now())
    with conn:
        conn.execute(
            """INSERT INTO facts (id, person_id, text, question, answer, category, tier, audience, status, source,
               created_by, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?, 'draft', ?, ?, 1, ?, ?)""",
            (fact_id, member["person_id"], text, draft["question"], draft["answer"], draft["category"],
             draft["tier"], draft["audience"], f"{member['name']}, typed in Care-Bridge", member["id"], t, t),
        )
    return fact_out(get_fact(fact_id))


class FactPatch(BaseModel):
    text: str | None = None
    question: str | None = None
    answer: str | None = None
    category: str | None = None
    tier: str | None = None
    audience: str | None = None


@app.patch("/api/facts/{fact_id}")
def edit_fact(fact_id: str, body: FactPatch, member: dict = Depends(current_member)):
    """B7: editing an approved fact bumps its version so every caregiver sees it as changed."""
    require_editor(member)
    fact = get_fact(fact_id)
    changes = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items() if v is not None}
    if not changes:
        return fact_out(fact)
    bump = fact["status"] == "approved"
    sets = ", ".join(f"{k} = ?" for k in changes)
    with conn:
        conn.execute(f"UPDATE facts SET {sets}, version = version + ?, updated_at = ? WHERE id = ?",
                     (*changes.values(), 1 if bump else 0, iso(now()), fact_id))
        if bump:
            log_event(conn, fact["person_id"], "fact_changed", member["id"], fact_id,
                      {"before": fact["text"], "after": changes.get("text", fact["text"])})
    return fact_out(get_fact(fact_id))


class ApproveIn(BaseModel):
    text: str | None = None
    question: str | None = None
    answer: str | None = None
    category: str | None = None
    tier: str | None = None
    audience: str | None = None


@app.post("/api/facts/{fact_id}/approve")
def approve_fact(fact_id: str, body: ApproveIn, member: dict = Depends(current_member)):
    """B3, C1: Priya approves a draft. An update draft rewrites the fact it replaces."""
    require_primary(member)
    draft = get_fact(fact_id)
    if draft["status"] != "draft":
        raise HTTPException(400, "Already approved")
    final = {k: (getattr(body, k) or draft[k]) for k in ("text", "question", "answer", "category", "tier", "audience")}
    if not final["question"] or not final["answer"]:
        raise HTTPException(400, "Add a question and answer before approving")
    t = iso(now())
    with conn:
        if draft["replaces_fact_id"]:
            old = get_fact(draft["replaces_fact_id"])
            conn.execute(
                """UPDATE facts SET text=?, question=?, answer=?, category=?, tier=?, audience=?, source=?,
                   approved_by=?, version = version + 1, updated_at=? WHERE id=?""",
                (*final.values(), draft["source"], member["id"], t, old["id"]),
            )
            conn.execute("DELETE FROM facts WHERE id = ?", (fact_id,))
            log_event(conn, old["person_id"], "fact_changed", member["id"], old["id"],
                      {"before": old["text"], "after": final["text"], "source": draft["source"]})
            return fact_out(get_fact(old["id"]))
        conn.execute(
            """UPDATE facts SET text=?, question=?, answer=?, category=?, tier=?, audience=?, status='approved',
               approved_by=?, updated_at=? WHERE id=?""",
            (*final.values(), member["id"], t, fact_id),
        )
        fact = get_fact(fact_id)
        ensure_cards(fact)
        log_event(conn, fact["person_id"], "fact_added", member["id"], fact_id,
                  {"text": fact["text"], "source": fact["source"]})
    return fact_out(fact)


@app.delete("/api/facts/{fact_id}")
def discard_draft(fact_id: str, member: dict = Depends(current_member)):
    require_primary(member)
    fact = get_fact(fact_id)
    if fact["status"] != "draft":
        raise HTTPException(400, "Only drafts can be discarded")
    with conn:
        conn.execute("DELETE FROM facts WHERE id = ?", (fact_id,))
    return {"ok": True}


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...), member: dict = Depends(current_member)):
    """B3: PDF → Gemma → draft facts (new or updates). Results are cached by file hash for the demo."""
    require_primary(member)
    data = await file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(400, "Upload a PDF")
    sha = hashlib.sha256(data).hexdigest()
    EXTRACT_CACHE.mkdir(parents=True, exist_ok=True)
    cache = EXTRACT_CACHE / f"{sha}.json"
    approved = rows(conn.execute("SELECT id, text FROM facts WHERE status = 'approved'"))
    if cache.exists():
        extracted = json.loads(cache.read_text())
        cached = True
    else:
        tmp = DATA_DIR / f"upload-{sha[:12]}.pdf"
        tmp.write_bytes(data)
        with pdfplumber.open(tmp) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        tmp.unlink(missing_ok=True)
        if len(text.strip()) < 80:
            raise HTTPException(422, "Couldn't read text from this PDF. Scanned PDFs aren't supported yet.")
        try:
            extracted = llm.extract_facts(text, approved)
        except Exception as exc:
            log.exception("extraction failed")
            raise HTTPException(502, f"Gemma couldn't draft facts: {type(exc).__name__}")
        cache.write_text(json.dumps(extracted, indent=2))
        cached = False

    known_ids = {f["id"] for f in approved}
    open_drafts = {r["replaces_fact_id"] for r in conn.execute(
        "SELECT replaces_fact_id FROM facts WHERE status='draft' AND replaces_fact_id IS NOT NULL")}
    doc_id = f"doc_{sha[:10]}"
    source = f"{file.filename or 'Uploaded PDF'}"
    created, same = [], []
    t = iso(now())
    with conn:
        for item in extracted:
            fields = {k: str(item.get(k, "")).strip() for k in ("text", "question", "answer")}
            if not fields["text"]:
                continue
            category = item.get("category") if item.get("category") in llm.CATEGORIES else "routines"
            tier = item.get("tier") if item.get("tier") in llm.TIERS else "routine"
            audience = item.get("audience") if item.get("audience") in llm.AUDIENCES else "caregivers"
            match, existing = item.get("match"), item.get("existing_fact_id") or None
            if existing not in known_ids:
                existing, match = None, "new"
            if match == "same":
                same.append(existing)
                continue
            replaces = existing if match == "update" and existing not in open_drafts else None
            fact_id = f"f_{secrets.token_hex(4)}"
            conn.execute(
                """INSERT INTO facts (id, person_id, text, question, answer, category, tier, audience, status,
                   source, created_by, version, replaces_fact_id, document_id, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?, 'draft', ?, ?, 1, ?, ?, ?, ?)""",
                (fact_id, member["person_id"], fields["text"], fields["question"], fields["answer"], category,
                 tier, audience, source, member["id"], replaces, doc_id, t, t),
            )
            created.append(fact_id)
        conn.execute("INSERT OR REPLACE INTO documents (id, person_id, filename, sha256, uploaded_by, summary, created_at)"
                     " VALUES (?,?,?,?,?,?,?)",
                     (doc_id, member["person_id"], file.filename, sha, member["id"],
                      json.dumps({"drafts": len(created), "already_known": len(same)}), t))
        log_event(conn, member["person_id"], "document_uploaded", member["id"], None,
                  {"filename": file.filename, "drafts": len(created), "already_known": len(same)})
    names = member_names()
    return {"document_id": doc_id, "cached": cached, "already_known": same,
            "drafts": [fact_out(get_fact(i), names) for i in created]}


# ---------- learning ----------

def _changed_before(fact_id: str) -> str | None:
    r = conn.execute("SELECT details FROM events WHERE fact_id = ? AND type = 'fact_changed' ORDER BY id DESC LIMIT 1",
                     (fact_id,)).fetchone()
    return json.loads(r["details"]).get("before") if r else None


@app.get("/api/brief")
def brief(member: dict = Depends(current_member)):
    """C2: up to five cards — changed facts first, then due facts, warning signs first."""
    if member["role"] not in memory.CAREGIVER_ROLES:
        raise HTTPException(403, "Briefs are for caregivers")
    t = now()
    names = member_names()
    items = []
    for r in rows(conn.execute(
            """SELECT c.card_json, c.seen_version, f.* FROM cards c JOIN facts f ON f.id = c.fact_id
               WHERE c.member_id = ? AND f.status = 'approved'""", (member["id"],))):
        state = memory.card_state(r["card_json"], t)
        changed = r["seen_version"] < r["version"] and r["seen_version"] > 0
        if not (changed or state["is_due"]):
            continue
        item = {"fact": fact_out(r, names), "state": state, "changed": changed}
        if changed:
            item["before"] = _changed_before(r["id"])
        items.append(item)
    items.sort(key=lambda i: (not i["changed"], TIER_ORDER.get(i["fact"]["tier"], 3), not i["fact"]["shifted"],
                              i["state"]["retrievability"]))
    total_due = len(items)
    upcoming = [memory.card_state(r["card_json"], t)["due"] for r in
                conn.execute("SELECT card_json FROM cards WHERE member_id = ?", (member["id"],))]
    return {"items": items[:5], "total_due": total_due,
            "next_due": min((d for d in upcoming if d > iso(t)), default=None)}


class ReviewIn(BaseModel):
    fact_id: str
    rating: str | None = None
    answer_text: str | None = None


@app.post("/api/reviews")
def record_review(body: ReviewIn, member: dict = Depends(current_member)):
    """C1, C3, C4: a typed answer is graded by Laya; otherwise the caregiver rates themselves. FSRS schedules."""
    fact = get_fact(body.fact_id)
    card = row(conn.execute("SELECT * FROM cards WHERE member_id = ? AND fact_id = ?",
                            (member["id"], fact["id"])).fetchone())
    if not card:
        raise HTTPException(404, "No card for this fact")
    grade = None
    rating = body.rating
    if not rating and body.answer_text and body.answer_text.strip():
        grade = laya.grade_answer(fact["question"], fact["answer"], body.answer_text.strip())
        if grade is None:
            try:
                grade = llm.grade_answer(fact["question"], fact["answer"], body.answer_text.strip())
            except Exception as exc:
                log.warning("Gemma grading failed: %s", exc)
        if grade is None:
            return {"needs_self_rating": True, "answer": fact["answer"], "reason": "Grading is unavailable"}
        rating = GRADE_TO_RATING[grade["grade"]]
    if rating not in memory.RATINGS:
        raise HTTPException(400, "Rating must be again, hard, good or easy")
    t = now()
    new_json = memory.review(card["card_json"], fact["tier"], bool(fact["shifted"]), rating, t)
    with conn:
        conn.execute("UPDATE cards SET card_json = ?, seen_version = ? WHERE member_id = ? AND fact_id = ?",
                     (new_json, fact["version"], member["id"], fact["id"]))
        conn.execute("INSERT INTO reviews (member_id, fact_id, rating, answer_text, grade, reviewed_at)"
                     " VALUES (?,?,?,?,?,?)",
                     (member["id"], fact["id"], rating, body.answer_text, grade["grade"] if grade else None, iso(t)))
        conn.execute("UPDATE members SET last_brief_at = ? WHERE id = ?", (iso(t), member["id"]))
    return {"rating": rating, "grade": grade, "answer": fact["answer"],
            "state": memory.card_state(new_json, t)}


@app.get("/api/progress")
def progress(member: dict = Depends(current_member)):
    """C7: what this caregiver knows well and what they keep forgetting."""
    t = now()
    out = []
    for r in rows(conn.execute(
            """SELECT c.card_json, f.id, f.text, f.tier FROM cards c JOIN facts f ON f.id = c.fact_id
               WHERE c.member_id = ? AND f.status='approved'""", (member["id"],))):
        out.append({"fact_id": r["id"], "text": r["text"], "tier": r["tier"], **memory.card_state(r["card_json"], t)})
    out.sort(key=lambda x: x["retrievability"])
    return out


# ---------- circle overview ----------

@app.get("/api/coverage")
def coverage(member: dict = Depends(current_member)):
    """D1, D2, E3: who reliably remembers each warning sign."""
    t = now()
    people = caregivers()
    facts = rows(conn.execute("SELECT * FROM facts WHERE status='approved' AND tier='warning' ORDER BY rowid"))
    signals = {r["fact_id"]: json.loads(r["details"]).get("summary") for r in conn.execute(
        "SELECT fact_id, details FROM events WHERE type = 'older_adult_signal' ORDER BY id")}
    grid, alerts = [], []
    for f in facts:
        cells = []
        for m in people:
            c = conn.execute("SELECT card_json FROM cards WHERE member_id=? AND fact_id=?", (m["id"], f["id"])).fetchone()
            state = memory.card_state(c["card_json"], t) if c else {"status": "red", "retrievability": 0.0}
            cells.append({"member_id": m["id"], "name": m["name"], "role": m["role"], **state})
        others_green = [c for c in cells if c["role"] != "primary" and c["status"] == "green"]
        if not others_green:
            alerts.append({"fact_id": f["id"], "text": f["text"],
                           "message": "Only Priya reliably remembers this warning sign."})
        grid.append({"fact": {"id": f["id"], "text": f["text"], "shifted": bool(f["shifted"])},
                     "ruth_signal": signals.get(f["id"]), "cells": cells})
    return {"members": [{"id": m["id"], "name": m["name"], "role": m["role"]} for m in people],
            "rows": grid, "alerts": alerts,
            "thresholds": {"green": memory.GREEN_AT, "amber": memory.AMBER_AT}}


@app.get("/api/changes")
def changes(member: dict = Depends(current_member)):
    """D3: newest first."""
    names = member_names()
    facts = {r["id"]: r["text"] for r in conn.execute("SELECT id, text FROM facts")}
    out = []
    for e in rows(conn.execute("SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT 60")):
        out.append({"id": e["id"], "type": e["type"], "actor": names.get(e["actor"], e["actor"]),
                    "fact_id": e["fact_id"], "fact_text": facts.get(e["fact_id"]),
                    "details": json.loads(e["details"] or "{}"), "created_at": e["created_at"]})
    return out


# ---------- demo controls ----------

@app.post("/api/demo/send-briefs")
def send_briefs(member: dict = Depends(current_member)):
    """C6: message each connected caregiver who has something due, with a button that opens their brief."""
    require_primary(member)
    t = now()
    sent = []
    for m in caregivers():
        if m["id"] == member["id"]:
            continue
        due = 0
        for r in conn.execute(
                """SELECT c.card_json, c.seen_version, f.version FROM cards c JOIN facts f ON f.id = c.fact_id
                   WHERE c.member_id = ? AND f.status = 'approved'""", (m["id"],)):
            if memory.card_state(r["card_json"], t)["is_due"] or 0 < r["seen_version"] < r["version"]:
                due += 1
        if not due:
            sent.append({"name": m["name"], "status": "nothing due"})
            continue
        if not m["telegram_id"]:
            sent.append({"name": m["name"], "status": "not connected to Telegram yet"})
            continue
        items = min(due, 5)
        text = (f"{m['name']}, here's your Care-Bridge brief for Ruth: {items} quick "
                f"{'item' if items == 1 else 'items'}, under a minute.")
        result = telegram.send_message(m["telegram_id"], text, "Open brief", "/?tab=brief")
        sent.append({"name": m["name"], "status": "sent" if result["ok"] else f"failed: {result.get('error')}"})
    return {"results": sent}


@app.post("/api/demo/reset")
def demo_reset(member: dict = Depends(current_member)):
    require_primary(member)
    keep = {r["id"]: r["telegram_id"] for r in conn.execute("SELECT id, telegram_id FROM members")}
    result = reset_and_seed(conn)
    with conn:
        for mid, tg in keep.items():
            if tg:
                conn.execute("UPDATE members SET telegram_id = ? WHERE id = ?", (tg, mid))
    return result


# ---------- explainers (E8) ----------

def build_explainer(fact: dict) -> dict:
    template = fact["explainer_template"]
    cached = row(conn.execute("SELECT * FROM explainers WHERE fact_id = ? AND fact_version = ?",
                              (fact["id"], fact["version"])).fetchone())
    if cached:
        return cached
    spec = None
    try:
        raw = llm.explainer_steps(fact["text"], template, TEMPLATES[template])
        steps = [s for s in raw.get("steps", []) if s.get("focus") in TEMPLATES[template] and 0 < len(s.get("text", "")) <= 120]
        numbers = set(re.findall(r"\d[\d-]*", fact["text"]))
        step_text = " ".join(s["text"] for s in steps)
        if len(steps) >= 2 and all(n in step_text for n in numbers):
            spec = {"template": template, "title": str(raw.get("title", ""))[:40] or "A quick guide", "steps": steps[:4]}
    except Exception as exc:
        log.warning("explainer generation failed: %s", exc)
    if spec is None:
        spec = fallback_spec(template)
    spec["fact_id"] = fact["id"]
    exp_id = f"exp_{fact['id']}_v{fact['version']}"
    with conn:
        conn.execute("INSERT OR REPLACE INTO explainers (id, fact_id, fact_version, spec, created_at) VALUES (?,?,?,?,?)",
                     (exp_id, fact["id"], fact["version"], json.dumps(spec), iso(now())))
    return row(conn.execute("SELECT * FROM explainers WHERE id = ?", (exp_id,)).fetchone())


@app.get("/api/explainers/{exp_id}")
def get_explainer(exp_id: str, member: dict = Depends(current_member)):
    exp = row(conn.execute("SELECT * FROM explainers WHERE id = ?", (exp_id,)).fetchone())
    if not exp:
        raise HTTPException(404, "Explainer not found")
    return {"id": exp["id"], **json.loads(exp["spec"])}


@app.post("/api/explainers/{exp_id}/done")
def explainer_done(exp_id: str, member: dict = Depends(current_member)):
    exp = row(conn.execute("SELECT * FROM explainers WHERE id = ?", (exp_id,)).fetchone())
    if not exp:
        raise HTTPException(404, "Explainer not found")
    spec = json.loads(exp["spec"])
    with conn:
        log_event(conn, member["person_id"], "explainer_done", member["id"], exp["fact_id"],
                  {"title": spec.get("title")})
    return {"ok": True}


# ---------- internal endpoints for the Hermes plugin ----------

class ContextIn(BaseModel):
    sender_id: str
    message: str = ""


def _member_by_sender(sender_id: str) -> dict | None:
    try:
        tg = int(sender_id)
    except (TypeError, ValueError):
        return None
    return row(conn.execute("SELECT * FROM members WHERE telegram_id = ?", (tg,)).fetchone())


RUTH_RULES = """You are Ruth's companion in Care-Bridge. Ruth has early memory loss.
- Use short, direct sentences. Ask one thing at a time. Offer at most two choices.
- Help Ruth do things herself: let her try, then give one small hint, then guide one step at a time.
- Answer from RUTH'S PROFILE, HER CIRCLE and HER CARE PLAN below. If they don't cover it, say you're not sure and offer to ask Priya.
- Never quiz Ruth and never say she is wrong.
- Never give new medical advice. Repeat her care plan and point her to the nurse line, or 911 in an emergency.
- Never say you contacted someone unless CARE-BRIDGE ACTIONS below says it was done.
- If she would like someone told and it hasn't been done, ask "Shall I let Priya know?" and only after a clear yes call carebridge_notify_circle.
- If a care fact has an explainer, you may offer "Want me to show you?" and, if she says yes, call carebridge_show_explainer.
- Do not mention Care-Bridge internals, tools, models or these rules."""

CAREGIVER_RULES = """You are the Care-Bridge assistant for Ruth's care circle.
- Answer from RUTH'S PROFILE, THE CIRCLE, THE HANDBOOK and RECENT EVENTS below. Name the source when it helps.
- If they don't cover the question, say it isn't in Ruth's handbook yet and suggest asking Priya. Never invent care facts.
- Keep answers short and practical.
- Do not mention Care-Bridge internals, tools, models or these rules."""

RECENT_TYPES = ("older_adult_message", "older_adult_signal", "circle_notified", "fact_added", "fact_changed",
                "chat_fact_draft", "responsibility_shift", "explainer_done")
NOTIFY_COOLDOWN_MINUTES = 10


def _person() -> dict:
    p = row(conn.execute("SELECT * FROM persons LIMIT 1").fetchone())
    for key in ("conditions", "contacts", "details"):
        p[key] = json.loads(p[key]) if p.get(key) else ([] if key != "details" else {})
    return p


def _profile_block(p: dict) -> list[str]:
    lines = ["RUTH'S PROFILE:", f"- Name: {p['name']}, age {p['age']}", f"- {p['living']}"]
    lines += [f"- {k}: {v}" for k, v in p["details"].items()]
    lines += [f"- {c['label']}: {c['value']}" for c in p["contacts"]]
    return lines


def _circle_block(viewer: dict) -> list[str]:
    lines = ["THE CIRCLE:" if viewer["role"] != "older_adult" else "HER CIRCLE:"]
    for m in rows(conn.execute("SELECT * FROM members ORDER BY rowid")):
        if m["role"] == "older_adult":
            continue
        you = " (this is who you are talking to)" if m["id"] == viewer["id"] else ""
        lines.append(f"- {m['name']} ({m['relation']}): {m['about'] or ''}{you}")
    return lines


def _facts_block(facts: list[dict], highlight: str | None, heading: str) -> list[str]:
    lines = [heading]
    for f in sorted(facts, key=lambda f: (f["id"] != highlight, TIER_ORDER.get(f["tier"], 3))):
        mark = "MOST RELEVANT: " if f["id"] == highlight else ""
        extra = " [has an explainer]" if f["explainer_template"] and f["audience"] == "everyone" else ""
        lines.append(f"- {mark}({f['id']}) {f['text']}{extra}")
    return lines


def _recent_block(viewer: dict) -> list[str]:
    names = member_names()
    cutoff = iso(now() - timedelta(days=3))
    marks = ",".join("?" * len(RECENT_TYPES))
    events = rows(conn.execute(
        f"SELECT * FROM events WHERE created_at >= ? AND type IN ({marks}) ORDER BY id DESC LIMIT 10",
        (cutoff, *RECENT_TYPES)))
    lines = []
    for e in reversed(events):
        d = json.loads(e["details"] or "{}")
        if viewer["role"] == "older_adult" and e["type"] not in ("older_adult_message", "circle_notified"):
            continue
        what = d.get("summary") or d.get("text") or d.get("after") or e["type"].replace("_", " ")
        lines.append(f"- {e['created_at'][:16].replace('T', ' ')} UTC, {names.get(e['actor'], e['actor'])}: {what}")
    return (["RECENT EVENTS:"] + lines) if lines else []


def _notify_circle(ruth: dict, summary: str, fact: dict | None, urgent: bool) -> list[str]:
    """Message every connected caregiver about Ruth. Skips if the circle was told in the last few minutes."""
    recent = conn.execute("SELECT created_at FROM events WHERE type = 'circle_notified' ORDER BY id DESC LIMIT 1").fetchone()
    if recent and recent["created_at"] >= iso(now() - timedelta(minutes=NOTIFY_COOLDOWN_MINUTES)) and not urgent:
        return []
    text = ("URGENT: " if urgent else "") + f"Ruth asked for help: {summary}"
    if fact:
        text += f"\n\nFrom her care plan: {fact['text']}"
    told = []
    for m in caregivers():
        if m["telegram_id"] and telegram.send_message(m["telegram_id"], text, "Open Care-Bridge", "/?tab=changes")["ok"]:
            told.append(m["name"])
    with conn:
        log_event(conn, ruth["person_id"], "circle_notified", ruth["id"], fact["id"] if fact else None,
                  {"summary": summary, "urgent": urgent, "told": told})
        if fact and not fact["shifted"]:
            conn.execute("UPDATE facts SET shifted = 1 WHERE id = ?", (fact["id"],))
            log_event(conn, ruth["person_id"], "responsibility_shift", "system", fact["id"],
                      {"summary": "Recall target for caregivers raised to 0.99."})
    return told


@app.post("/api/internal/context", dependencies=[Depends(internal_only)])
def internal_context(body: ContextIn):
    """E7 and D5: read the message, act on what Python is allowed to act on, and build Gemma's context."""
    member = _member_by_sender(body.sender_id)
    if not member:
        return {"role": None, "context": ""}
    is_ruth = member["role"] == "older_adult"
    person = _person()
    audience = ("everyone",) if is_ruth else ("everyone", "caregivers")
    facts = [f for f in rows(conn.execute("SELECT * FROM facts WHERE status = 'approved'")) if f["audience"] in audience]
    options = [{"id": f["id"], "label": f["text"][:140]} for f in facts]
    message = body.message.strip()

    hints = laya.read_message(message, options) if message else None
    analysis = None
    if message:
        try:
            analysis = llm.analyze_message(member["role"], message, options, person["conditions"])
        except Exception as exc:
            log.warning("analyze_message failed: %s", exc)
    if hints and hints["fact_confidence"] >= LAYA_FACT_AT:
        fact_id, by = hints["fact_id"], "laya"
    elif analysis is not None:
        fact_id, by = analysis.get("fact_id"), "gemma"
    else:
        fact_id, by = laya.keyword_pick(message, options), "keywords"
    fact = next((f for f in facts if f["id"] == fact_id), None)
    actions: list[str] = []

    if is_ruth and analysis:
        wants, unwell, emergency = (bool(analysis.get(k)) for k in ("asks_for_person", "feeling_unwell", "emergency"))
        summary = (analysis.get("summary") or message)[:300]
        if wants or unwell or emergency:
            with conn:
                log_event(conn, member["person_id"], "older_adult_message", member["id"], fact["id"] if fact else None,
                          {"summary": summary, "message": message[:500], "asks_for_person": wants,
                           "feeling_unwell": unwell, "emergency": emergency})
        if wants or emergency:
            # Asking for someone is Ruth's consent; an emergency is told to the circle as well as 911.
            told = _notify_circle(member, summary, fact, urgent=emergency or unwell)
            if told:
                actions.append(f"Care-Bridge has just sent a Telegram message to {', '.join(told)} saying: {summary} "
                               "Tell Ruth they have been told. Do not call carebridge_notify_circle again.")
            else:
                actions.append("Her circle was already told a few minutes ago. Tell Ruth they know. "
                               "Do not call carebridge_notify_circle again.")
            if emergency:
                actions.append("This sounds like an emergency: tell Ruth to call 911 now, using her care plan.")
        elif unwell:
            actions.append("Ruth says she isn't feeling well; this is now noted for her circle in Care-Bridge. "
                           "Check her care plan for what applies, then ask if she'd like you to let Priya know.")

    if not is_ruth and analysis and analysis.get("shares_new_care_info") and analysis.get("new_fact_text", "").strip():
        text = analysis["new_fact_text"].strip()
        exists = conn.execute("SELECT 1 FROM facts WHERE lower(text) = lower(?)", (text,)).fetchone()
        if not exists:
            draft = add_fact(FactIn(text=text), member) if member["role"] in EDITOR_ROLES else None
            if draft is None:  # aides can't edit the handbook, so their note becomes a draft owned by Priya
                draft = add_fact(FactIn(text=text), row(conn.execute("SELECT * FROM members WHERE role='primary'").fetchone()))
                conn.execute("UPDATE facts SET created_by = ?, source = ? WHERE id = ?",
                             (member["id"], f"{member['name']}, in Telegram chat", draft["id"]))
            else:
                conn.execute("UPDATE facts SET source = ? WHERE id = ?", (f"{member['name']}, in Telegram chat", draft["id"]))
            if fact:  # new information about an existing fact is an update for Priya to approve
                conn.execute("UPDATE facts SET replaces_fact_id = ? WHERE id = ?", (fact["id"], draft["id"]))
            with conn:
                log_event(conn, member["person_id"], "chat_fact_draft", member["id"], draft["id"], {"text": text})
            who = "your" if member["role"] == "primary" else "Priya's"
            actions.append(f"Care-Bridge saved this as a draft fact for {who} approval in the Handbook tab: \"{text}\". "
                           "Tell them so.")

    lines = [RUTH_RULES if is_ruth else CAREGIVER_RULES, ""]
    if not is_ruth:
        lines.append(f"You are talking to {member['name']} ({member['relation']}, role: {member['role']}).")
    lines += _profile_block(person) + [""] + _circle_block(member) + [""]
    lines += _facts_block(facts, fact["id"] if fact else None, "HER CARE PLAN:" if is_ruth else "THE HANDBOOK:")
    recent = _recent_block(member)
    if recent:
        lines += [""] + recent
    if actions:
        lines += ["", "CARE-BRIDGE ACTIONS (already done by the system):"] + [f"- {a}" for a in actions]
    if hints and (hints.get("unsure") or 0) >= LAYA_HINT_AT:
        lines.append("Hint from a fast classifier (a suggestion, not permission to act): she may be confused or stuck; "
                     "slow down and offer one small step.")
    decision = {"fact_id": fact["id"] if fact else None, "by": by, "analysis": analysis,
                "laya": {k: hints[k] for k in ("fact_id", "fact_confidence", "intent", "unsure")} if hints else None}
    return {"role": member["role"], "fact_id": decision["fact_id"], "decision": decision, "actions": actions,
            "context": "\n".join(lines)}


class NotifyIn(BaseModel):
    sender_id: str
    summary: str
    fact_id: str | None = None


@app.post("/api/internal/notify", dependencies=[Depends(internal_only)])
def internal_notify(body: NotifyIn):
    """E7: after Ruth says yes, tell the circle. Also shifts that fact's responsibility to caregivers (E3)."""
    member = _member_by_sender(body.sender_id)
    if not member or member["role"] != "older_adult":
        return {"ok": False, "error": "Only Ruth's messages can notify the circle"}
    fact = row(conn.execute("SELECT * FROM facts WHERE id = ?", (body.fact_id,)).fetchone()) if body.fact_id else None
    told = _notify_circle(member, body.summary.strip()[:300], fact, urgent=False)
    return {"ok": True, "told": told, "already_told": not told}


class ExplainerIn(BaseModel):
    sender_id: str
    fact_id: str


@app.post("/api/internal/explainer", dependencies=[Depends(internal_only)])
def internal_explainer(body: ExplainerIn):
    """E8: build (or reuse) the explainer for a fact and send Ruth a "Show me" button."""
    member = _member_by_sender(body.sender_id)
    if not member:
        return {"ok": False, "error": "Unknown sender"}
    fact = get_fact(body.fact_id)
    if not fact["explainer_template"] or fact["audience"] != "everyone":
        return {"ok": False, "error": "No explainer for this fact"}
    exp = build_explainer(fact)
    spec = json.loads(exp["spec"])
    result = telegram.send_message(member["telegram_id"], f"Here's a short guide: {spec['title']}", "Show me",
                                   f"/explain/?id={exp['id']}")
    return {"ok": result["ok"], "explainer_id": exp["id"], "button": result.get("button"), "error": result.get("error")}


# ---------- static apps ----------

def _mount(path: str, directory: Path) -> None:
    if directory.exists():
        app.mount(path, StaticFiles(directory=directory, html=True), name=path.strip("/") or "root")


_mount("/explain", ROOT / "apps" / "explainer" / "dist")
_mount("/", ROOT / "apps" / "miniapp" / "dist")
