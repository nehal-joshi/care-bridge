"""Load demo/seed.json into a fresh database, with backdated FSRS review history."""
import json
import secrets
import sqlite3
from datetime import timedelta

from . import memory
from .config import DEMO_DIR
from .db import iso, log_event, now

SEED_FILE = DEMO_DIR / "seed.json"
TABLES = ("persons", "members", "invites", "facts", "cards", "reviews", "events", "explainers", "documents")


def load_seed() -> dict:
    return json.loads(SEED_FILE.read_text())


def reset_and_seed(conn: sqlite3.Connection) -> dict:
    seed = load_seed()
    t0 = now()
    with conn:
        for table in TABLES:
            conn.execute(f"DELETE FROM {table}")

        p = seed["person"]
        conn.execute(
            "INSERT INTO persons (id, name, age, conditions, living, contacts) VALUES (?,?,?,?,?,?)",
            (p["id"], p["name"], p["age"], json.dumps(p["conditions"]), p["living"], json.dumps(p["contacts"])),
        )
        for m in seed["members"]:
            conn.execute(
                "INSERT INTO members (id, person_id, name, role, relation, telegram_id, claim_code) VALUES (?,?,?,?,?,?,?)",
                (m["id"], p["id"], m["name"], m["role"], m["relation"], m["telegram_id"],
                 f"claim_{m['id']}_{secrets.token_hex(3)}"),
            )
        created = iso(t0 - timedelta(days=45))
        for f in seed["facts"]:
            conn.execute(
                """INSERT INTO facts (id, person_id, text, question, answer, category, tier, audience, status,
                   source, created_by, approved_by, version, explainer_template, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?, 'approved', ?,?,?, 1, ?,?,?)""",
                (f["id"], p["id"], f["text"], f["question"], f["answer"], f["category"], f["tier"],
                 f["audience"], f["source"], f["created_by"], f["created_by"], f.get("explainer_template"),
                 created, created),
            )

        facts = {f["id"]: f for f in seed["facts"]}
        caregivers = [m for m in seed["members"] if m["role"] in memory.CAREGIVER_ROLES]
        shifted = {e["fact_id"] for e in seed.get("events", []) if e["type"] == "older_adult_signal"}
        for fid in shifted:
            conn.execute("UPDATE facts SET shifted = 1 WHERE id = ?", (fid,))

        for m in caregivers:
            history = seed["reviews"].get(m["id"], {})
            for fid, f in facts.items():
                card_json = memory.new_card_json()
                for days_ago, rating in history.get(fid, history.get("*", [])):
                    at = t0 - timedelta(days=days_ago)
                    card_json = memory.review(card_json, f["tier"], fid in shifted, rating, at)
                    conn.execute(
                        "INSERT INTO reviews (member_id, fact_id, rating, reviewed_at) VALUES (?,?,?,?)",
                        (m["id"], fid, rating, iso(at)),
                    )
                conn.execute(
                    "INSERT INTO cards (member_id, fact_id, card_json, seen_version) VALUES (?,?,?,1)",
                    (m["id"], fid, card_json),
                )

        for e in seed.get("events", []):
            log_event(conn, p["id"], e["type"], e["actor"], e.get("fact_id"), e.get("details"),
                      at=t0 - timedelta(days=e["days_ago"]))
            if e["type"] == "older_adult_signal":
                log_event(conn, p["id"], "responsibility_shift", "system", e.get("fact_id"),
                          {"summary": "Recall target for caregivers raised to 0.99."},
                          at=t0 - timedelta(days=e["days_ago"]) + timedelta(minutes=1))

        for template, spec in seed.get("explainers", {}).items():
            for fid, f in facts.items():
                if f.get("explainer_template") == template:
                    conn.execute(
                        "INSERT INTO explainers (id, fact_id, fact_version, spec, created_at) VALUES (?,?,?,?,?)",
                        (f"exp_{fid}_v1", fid, 1, json.dumps({**spec, "fact_id": fid}), iso(t0)),
                    )
    return {"facts": len(seed["facts"]), "members": len(seed["members"])}


def fallback_spec(template: str) -> dict | None:
    return load_seed().get("explainers", {}).get(template)
