"""SQLite schema and small query helpers."""
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY, name TEXT, age INTEGER, conditions TEXT, living TEXT, contacts TEXT
);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY, person_id TEXT, name TEXT, role TEXT, relation TEXT,
  telegram_id INTEGER UNIQUE, claim_code TEXT UNIQUE, last_brief_at TEXT
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY, person_id TEXT, role TEXT, created_by TEXT, used_by TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY, person_id TEXT, text TEXT, question TEXT, answer TEXT,
  category TEXT, tier TEXT, audience TEXT, status TEXT, source TEXT,
  created_by TEXT, approved_by TEXT, version INTEGER DEFAULT 1,
  explainer_template TEXT, shifted INTEGER DEFAULT 0,
  replaces_fact_id TEXT, document_id TEXT,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS cards (
  member_id TEXT, fact_id TEXT, card_json TEXT, seen_version INTEGER,
  PRIMARY KEY (member_id, fact_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT, fact_id TEXT, rating TEXT,
  answer_text TEXT, grade TEXT, reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, person_id TEXT, type TEXT, actor TEXT,
  fact_id TEXT, details TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS explainers (
  id TEXT PRIMARY KEY, fact_id TEXT, fact_version INTEGER, spec TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, person_id TEXT, filename TEXT, sha256 TEXT, uploaded_by TEXT,
  summary TEXT, created_at TEXT
);
"""


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def row(r: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(r) if r is not None else None


def rows(rs) -> list[dict[str, Any]]:
    return [dict(r) for r in rs]


def log_event(conn: sqlite3.Connection, person_id: str, type_: str, actor: str | None,
              fact_id: str | None = None, details: dict | None = None, at: datetime | None = None) -> None:
    conn.execute(
        "INSERT INTO events (person_id, type, actor, fact_id, details, created_at) VALUES (?,?,?,?,?,?)",
        (person_id, type_, actor, fact_id, json.dumps(details or {}), iso(at or now())),
    )
