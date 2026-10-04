"""Load demo/seed.json into a fresh database, with backdated FSRS review history."""
import json
import secrets
import sqlite3
from datetime import timedelta

from . import daily, memory
from .config import DEMO_DIR, settings
from .db import iso, log_event, now

SEED_FILE = DEMO_DIR / "seed.json"
TABLES = ("persons", "members", "invites", "facts", "cards", "reviews", "events", "explainers", "documents",
          "schedules", "logs")


def _telegram_ids() -> dict[str, int]:
    """CAREBRIDGE_TELEGRAM_IDS=priya:123,marcus:456 in local.env maps seeded people to real Telegram accounts."""
    out = {}
    for pair in settings.telegram_ids.split(","):
        if ":" in pair:
            member, tg = pair.split(":", 1)
            if tg.strip().isdigit():
                out[member.strip()] = int(tg.strip())
    return out


def load_seed() -> dict:
    seed = json.loads(SEED_FILE.read_text())
    ids = _telegram_ids()
    for m in seed["members"]:
        m["telegram_id"] = ids.get(m["id"], m.get("telegram_id"))
    return seed


def reset_and_seed(conn: sqlite3.Connection) -> dict:
    seed = load_seed()
    t0 = now()
    with conn:
        for table in TABLES:
            conn.execute(f"DELETE FROM {table}")

        p = seed["person"]
        conn.execute(
            "INSERT INTO persons (id, name, age, conditions, living, contacts, details) VALUES (?,?,?,?,?,?,?)",
            (p["id"], p["name"], p["age"], json.dumps(p["conditions"]), p["living"], json.dumps(p["contacts"]),
             json.dumps(p.get("details", {}))),
        )
        for m in seed["members"]:
            conn.execute(
                "INSERT INTO members (id, person_id, name, role, relation, telegram_id, claim_code, about)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (m["id"], p["id"], m["name"], m["role"], m["relation"], m["telegram_id"],
                 f"claim_{m['id']}_{secrets.token_hex(3)}", m.get("about")),
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

        daily.seed_schedules(conn, seed)

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


def backfill_profile(conn: sqlite3.Connection) -> None:
    """Fill profile details on a database seeded before they existed, without touching anything else."""
    seed = load_seed()
    with conn:
        conn.execute("UPDATE persons SET details = ? WHERE id = ? AND details IS NULL",
                     (json.dumps(seed["person"].get("details", {})), seed["person"]["id"]))
        for m in seed["members"]:
            conn.execute("UPDATE members SET about = ? WHERE id = ? AND about IS NULL", (m.get("about"), m["id"]))
        if conn.execute("SELECT COUNT(*) FROM schedules").fetchone()[0] == 0:
            daily.seed_schedules(conn, seed)
