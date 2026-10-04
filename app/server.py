#!/usr/bin/env python3
"""Care-Bridge localhost dashboard + API + Telegram bot (stdlib only).

Run:  python3 app/server.py
Open: http://localhost:8000

Optional Telegram (reminders + /brief in chat):
  export TELEGRAM_BOT_TOKEN="123:ABC"
  export TELEGRAM_CHAT_ID="your numeric id"   # for Test reminder button
  python3 app/server.py

No pip dependencies. SQLite file: app/carebridge.db
FSRS-lite: simplified stability model. Drop in py-fsrs `Scheduler`
where marked (C1/C5) without changing the API shape.
"""
import json
import math
import os
import sqlite3
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "carebridge.db")
STATIC = os.path.join(BASE, "static")
PORT = int(os.environ.get("PORT", "8000"))
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
BOT_USERNAME = os.environ.get("TELEGRAM_BOT_USERNAME", "").strip() or "YourCareBridgeBot"
DEFAULT_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

TIER_TARGET = {"warning": 0.97, "routine": 0.90, "nice": 0.85}
TIER_LABEL = {"warning": "warning sign", "routine": "routine", "nice": "nice to know"}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    con = db()
    c = con.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS members(
      id TEXT PRIMARY KEY, name TEXT, role TEXT, last_brief_at TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS facts(
      id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, question TEXT,
      category TEXT, tier TEXT, audience TEXT, source TEXT,
      is_changed INTEGER DEFAULT 0, updated_at TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS cards(
      fact_id INTEGER, user_id TEXT, stability REAL DEFAULT 1.0,
      due_at TEXT, last_rating INTEGER, last_reviewed_at TEXT,
      PRIMARY KEY(fact_id, user_id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, text TEXT, created_at TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS settings(
      key TEXT PRIMARY KEY, value TEXT)""")
    con.commit()
    if c.execute("SELECT COUNT(*) n FROM facts").fetchone()["n"] == 0:
        seed(con)
    con.close()


def log(con, kind, text):
    con.execute("INSERT INTO events(kind,text,created_at) VALUES(?,?,?)",
                (kind, text, now_iso()))


def get_setting(con, key, default=""):
    row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def telegram_link(con):
    """Attachable Telegram link: stored setting wins, else bot username fallback."""
    custom = get_setting(con, "telegram_link", "").strip()
    if custom:
        return custom
    return f"https://t.me/{BOT_USERNAME}?start=circle_ruth"


def seed(con):
    c = con.cursor()
    members = [
        ("priya", "Priya", "primary (daughter)"),
        ("marcus", "Marcus", "aide (weekdays)"),
        ("dev", "Dev", "family (weekends)"),
    ]
    for mid, name, role in members:
        c.execute("INSERT OR IGNORE INTO members VALUES(?,?,?,?)",
                  (mid, name, role, None))
    facts = [
        ("If Ruth gains more than 3 lb overnight, call the heart failure nurse.", "Ruth gains 3 lb overnight — what do you do?", "meds", "warning", "all", "discharge instructions, 28 Sep 2026"),
        ("Evening pills: give WITH pudding, after the 7pm news, not before. (Priya updated Tue)", "How do Ruth's evening pills work?", "meds", "warning", "all", "Priya voice note, Tue"),
        ("Allergy: penicillin — rash and swelling. Listed on chart.", "What is Ruth allergic to?", "allergies", "warning", "all", "discharge PDF p.1"),
        ("Lasix (furosemide) 40mg every morning with water. Weigh before dose.", "When/how does Ruth take Lasix?", "meds", "warning", "all", "discharge PDF p.2"),
        ("Low-salt: no added salt, no pickles/papad. Max 2g sodium/day.", "What is Ruth's salt limit?", "diet", "routine", "all", "discharge PDF p.3"),
        ("Fluid limit: max 2 litres per day. Mark the jug.", "What is Ruth's fluid limit?", "diet", "routine", "all", "discharge PDF p.3"),
        ("Swollen ankles + shortness of breath = call nurse same day.", "Ankles swell and she's breathless — action?", "warning signs", "warning", "all", "discharge PDF p.2"),
        ("Walker always, even to bathroom. Lock brakes before standing.", "How does Ruth use the walker?", "mobility", "warning", "all", "agency care plan"),
        ("Count to five before standing (dizzy spells).", "What before Ruth stands up?", "mobility", "routine", "all", "Priya note"),
        ("Follow-up: Dr. Rao, cardiology, Oct 14 10am. Bring med list.", "When is the follow-up?", "contacts", "routine", "all", "discharge PDF p.4"),
        ("Night routine: bathroom, teeth, pudding + pills after news, nightlight on.", "Describe the night routine.", "routines", "routine", "all", "Priya note"),
        ("Upset triggers: loud TV, being rushed. Speak slowly, one step at a time.", "What upsets Ruth / what helps?", "behaviour", "nice", "all", "agency care plan"),
        ("Favourite: old Hindi songs after lunch — calms her.", "What calms Ruth after lunch?", "behaviour", "nice", "all", "Dev note"),
        ("Emergency: chest pain >5 min → call 911, then Priya.", "Chest pain over 5 min — action?", "contacts", "warning", "all", "discharge PDF p.1"),
        ("UTI signs in elderly: sudden confusion, low-grade fever → call clinic.", "Signs of UTI confusion?", "warning signs", "routine", "all", "caregiver guide (URL)"),
    ]
    for text, q, cat, tier, aud, src in facts:
        c.execute("""INSERT INTO facts(text,question,category,tier,audience,source,updated_at)
                     VALUES(?,?,?,?,?,?,?)""",
                  (text, q, cat, tier, aud, src, now_iso()))
    log(con, "seed", "Seeded Ruth's circle: Priya, Marcus, Dev + 15 facts")
    log(con, "change", "Priya updated evening-pills fact: pudding after 7pm news")
    log(con, "alert-fake", "FAKE demo alert (D2): no caregiver reliably knows the weight rule yet")
    log(con, "shift-fake", "FAKE demo (E3): Ruth missed weight rule twice → raised target for caregivers")
    con.commit()


# ---- FSRS-lite (swap with py-fsrs Scheduler here for C1/C5) ----
def target_for(tier):
    return TIER_TARGET.get(tier, 0.9)


def retrievability(stability_days, elapsed_days):
    stability_days = max(stability_days, 0.05)
    return math.exp(-max(elapsed_days, 0) / stability_days)


def card_state(con, fact_id, user_id, tier):
    row = con.execute("SELECT * FROM cards WHERE fact_id=? AND user_id=?",
                      (fact_id, user_id)).fetchone()
    if row is None:
        return {"stability": 1.0, "due_at": None, "last_rating": None,
                "last_reviewed_at": None, "retr": 0.3}
    stab = row["stability"] or 1.0
    last = row["last_reviewed_at"]
    el = 0.0
    if last:
        try:
            dt = datetime.fromisoformat(last)
            el = (datetime.now(timezone.utc) - dt).total_seconds() / 86400
        except Exception:
            el = 0.0
    return {"stability": stab, "due_at": row["due_at"], "last_rating": row["last_rating"],
            "last_reviewed_at": last, "retr": retrievability(stab, el)}


def apply_rating(stability, rating):
    # Again=1 Hard=2 Good=3 Easy=4  (matches py-fsrs mapping)
    if rating == 1:
        return max(0.2, stability * 0.4)
    if rating == 2:
        return max(0.3, stability * 0.85)
    if rating == 3:
        return stability * 1.9
    return stability * 2.8
# ---- end FSRS-lite ----


def send_telegram(chat_id, text):
    if not BOT_TOKEN or not chat_id:
        return {"ok": False, "error": "BOT_TOKEN or chat_id missing"}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = json.dumps({"chat_id": chat_id, "text": text[:4000]}).encode()
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return {"ok": True, "response": json.loads(r.read().decode())}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def brief_for(user_id):
    con = db()
    mem = con.execute("SELECT * FROM members WHERE id=?", (user_id,)).fetchone()
    if not mem:
        con.close()
        return {"error": "unknown user"}
    last_brief = mem["last_brief_at"]
    facts = con.execute("SELECT * FROM facts ORDER BY id").fetchall()
    due, changed, ok = [], [], []
    for f in facts:
        st = card_state(con, f["id"], user_id, f["tier"])
        tgt = target_for(f["tier"])
        item = {"id": f["id"], "question": f["question"] or f["text"],
                "answer": f["text"], "category": f["category"], "tier": f["tier"],
                "source": f["source"], "retrievability": round(st["retr"], 3),
                "target": tgt, "due": st["retr"] < tgt, "is_changed": bool(f["is_changed"])}
        if st["retr"] >= tgt and not f["is_changed"]:
            ok.append(item)
        else:
            if f["is_changed"]:
                changed.append(item)
            if st["retr"] < tgt:
                due.append(item)
            elif f["is_changed"]:
                pass
    # order: warnings first, then lowest retrievability
    due.sort(key=lambda x: (x["tier"] != "warning", x["retrievability"]))
    con.close()
    head = [d for d in due if d["tier"] == "warning"][:3]
    return {"user": user_id, "due": due[:8], "changed": changed[:8],
            "known": len(ok), "headline": head, "last_brief_at": last_brief}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _parse(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode())
        except Exception:
            return {}

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        path, qs = u.path, urllib.parse.parse_qs(u.query)
        if path.startswith("/api/"):
            return self.api_get(path, qs)
        # static
        rel = path.lstrip("/") or "index.html"
        fp = os.path.join(STATIC, rel)
        if os.path.isdir(fp):
            fp = os.path.join(fp, "index.html")
        if not os.path.exists(fp):
            fp = os.path.join(STATIC, "index.html")
        ext = os.path.splitext(fp)[1]
        ctype = {" .html": "text/html"}.get(ext, None) or \
            {".html": "text/html", ".js": "text/javascript",
             ".css": "text/css", ".png": "image/png"}.get(ext, "text/plain")
        try:
            with open(fp, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_response(500)
            self.end_headers()

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path.startswith("/api/"):
            return self.api_post(u.path, self._parse())
        self.send_response(404)
        self.end_headers()

    def do_PUT(self):
        u = urllib.parse.urlparse(self.path)
        if u.path.startswith("/api/"):
            return self.api_put(u.path, self._parse())
        self.send_response(404)
        self.end_headers()

    # ----- API -----
    def api_get(self, path, qs):
        con = db()
        if path == "/api/circle":
            members = [dict(r) for r in con.execute("SELECT * FROM members")]
            facts_n = con.execute("SELECT COUNT(*) n FROM facts").fetchone()["n"]
            invite = telegram_link(con)
            custom = bool(get_setting(con, "telegram_link", "").strip())
            con.close()
            return self._json({"person": {"name": "Ruth", "age": 78,
                "conditions": "heart failure, hypertension",
                "contacts": "Priya (daughter, primary) · Dr. Rao cardiology Oct 14",
                "photo": "👵"},
                "members": members, "facts_count": facts_n,
                "invite": invite,
                "invite_custom": custom,
                "bot_connected": bool(BOT_TOKEN)})
        if path == "/api/settings":
            out = {r["key"]: r["value"]
                   for r in con.execute("SELECT key,value FROM settings")}
            out.setdefault("telegram_link", telegram_link(con))
            con.close()
            return self._json({"settings": out})
        if path == "/api/facts":
            q = (qs.get("q", [""])[0] or "").lower()
            rows = con.execute("SELECT * FROM facts ORDER BY id").fetchall()
            out = []
            for f in rows:
                d = dict(f)
                if q and q not in (d["text"] + " " + (d["category"] or "")).lower():
                    continue
                out.append(d)
            con.close()
            return self._json({"facts": out})
        if path == "/api/brief":
            user = qs.get("user", ["marcus"])[0]
            con.close()
            return self._json(brief_for(user))
        if path == "/api/coverage":
            members = [dict(r) for r in con.execute("SELECT * FROM members")]
            warns = con.execute("SELECT * FROM facts WHERE tier='warning' ORDER BY id").fetchall()
            grid = []
            for f in warns:
                row = {"fact_id": f["id"], "question": f["question"] or f["text"], "per_user": {}}
                for m in members:
                    st = card_state(con, f["id"], m["id"], f["tier"])
                    row["per_user"][m["id"]] = {"retr": round(st["retr"], 2),
                        "reliable": st["retr"] >= target_for("warning"),
                        "last_rating": st["last_rating"]}
                n_rel = sum(1 for v in row["per_user"].values() if v["reliable"])
                row["covered"] = n_rel > 0
                row["n_reliable"] = n_rel
                grid.append(row)
            con.close()
            # FAKE D2 alert: fires when a warning has zero reliable caregivers
            alerts = [g for g in grid if not g["covered"]]
            return self._json({"grid": grid, "alerts": alerts,
                "note": "D2 coverage alert is seeded/fake for the demo hackathon scope."})
        if path == "/api/changes":
            rows = con.execute("SELECT * FROM events ORDER BY id DESC LIMIT 30").fetchall()
            con.close()
            return self._json({"events": [dict(r) for r in rows]})
        con.close()
        return self._json({"error": "unknown endpoint"}, 404)

    def api_post(self, path, body):
        con = db()
        if path == "/api/settings":
            link = (body.get("telegram_link") or "").strip()
            if link and not link.startswith(("https://t.me/", "http://t.me/", "t.me/")):
                con.close()
                return self._json({"error": "link must be a t.me link"}, 400)
            if link.startswith("t.me/"):
                link = "https://" + link
            con.execute("""INSERT INTO settings(key,value) VALUES('telegram_link',?)
                           ON CONFLICT(key) DO UPDATE SET value=excluded.value""", (link,))
            log(con, "settings", f"Telegram link attached: {link or '(cleared)'}")
            con.commit()
            con.close()
            return self._json({"ok": True, "telegram_link": link})
        if path == "/api/facts":
            text = (body.get("text") or "").strip()
            if not text:
                con.close()
                return self._json({"error": "text required"}, 400)
            con.execute("""INSERT INTO facts(text,question,category,tier,audience,source,updated_at)
                           VALUES(?,?,?,?,?,?,?)""",
                        (text, body.get("question") or text,
                         body.get("category", "general"),
                         body.get("tier", "routine"),
                         body.get("audience", "all"),
                         body.get("source", "hand-typed") + f" · {now_iso()[:10]}",
                         now_iso()))
            log(con, "change", f"New fact added: {text[:90]}")
            con.commit()
            con.close()
            return self._json({"ok": True})
        if path == "/api/upload":
            # B3 simplified: paste discharge text, each non-empty line -> draft fact
            text = (body.get("text") or "").strip()
            lines = [l.strip(" -•\t") for l in text.splitlines() if len(l.strip()) > 12]
            drafts = lines[:12]
            con.close()
            return self._json({"drafts": drafts,
                "hint": "Review each line, then POST to /api/facts to approve (B3 approve step)."})
        if path == "/api/reviews":
            try:
                fid, user, rating = int(body["fact_id"]), body["user"], int(body["rating"])
            except Exception:
                con.close()
                return self._json({"error": "fact_id, user, rating(1-4) required"}, 400)
            f = con.execute("SELECT * FROM facts WHERE id=?", (fid,)).fetchone()
            if not f:
                con.close()
                return self._json({"error": "unknown fact"}, 404)
            st = card_state(con, fid, user, f["tier"])
            new_stab = apply_rating(st["stability"], rating)
            tgt = target_for(f["tier"])
            # interval grows with stability; warnings reviewed sooner via target factor
            interval = max(0.25, new_stab * (tgt / 0.9))
            con.execute("""INSERT INTO cards(fact_id,user_id,stability,due_at,last_rating,last_reviewed_at)
                           VALUES(?,?,?,?,?,?)
                           ON CONFLICT(fact_id,user_id) DO UPDATE SET
                           stability=excluded.stability, due_at=excluded.due_at,
                           last_rating=excluded.last_rating,
                           last_reviewed_at=excluded.last_reviewed_at""",
                        (fid, user, new_stab, now_iso(), rating, now_iso()))
            log(con, "review", f"{user} rated fact #{fid} {rating} ({f['tier']})")
            con.commit()
            con.close()
            return self._json({"ok": True, "stability": round(new_stab, 2),
                               "next_due_days": round(interval, 2)})
        if path == "/api/brief/seen":
            user = body.get("user", "marcus")
            con.execute("UPDATE members SET last_brief_at=? WHERE id=?", (now_iso(), user))
            con.execute("UPDATE facts SET is_changed=0")
            log(con, "brief", f"{user} opened pre-shift brief")
            con.commit()
            con.close()
            return self._json({"ok": True})
        if path == "/api/remind":
            # C6: build reminder text + send via Telegram if configured
            user = body.get("user", "marcus")
            chat_id = body.get("chat_id") or DEFAULT_CHAT_ID
            con.close()
            b = brief_for(user)
            due_n = len(b.get("due", []))
            if due_n == 0:
                msg = f"Care-Bridge: nothing due for {user} right now. ✅"
            else:
                top = b["due"][0]
                msg = (f"Care-Bridge reminder for {user}: {due_n} card(s) due. "
                       f"Start with: {top['question']} "
                       f"Open http://localhost:{PORT}/?user={user}")
            res = send_telegram(chat_id, msg) if chat_id else {"ok": False, "error": "no chat_id"}
            return self._json({"message": msg, "telegram": res,
                "hint": "Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env vars to deliver to Telegram."})
        con.close()
        return self._json({"error": "unknown endpoint"}, 404)

    def api_put(self, path, body):
        con = db()
        if path.startswith("/api/facts/"):
            try:
                fid = int(path.rsplit("/", 1)[1])
            except ValueError:
                con.close()
                return self._json({"error": "bad id"}, 400)
            f = con.execute("SELECT * FROM facts WHERE id=?", (fid,)).fetchone()
            if not f:
                con.close()
                return self._json({"error": "unknown fact"}, 404)
            new_text = body.get("text", f["text"])
            con.execute("UPDATE facts SET text=?, question=?, category=?, tier=?, updated_at=?, is_changed=1 WHERE id=?",
                        (new_text, body.get("question", f["question"]),
                         body.get("category", f["category"]), body.get("tier", f["tier"]),
                         now_iso(), fid))
            log(con, "change", f"Fact #{fid} edited → flagged for every caregiver: {new_text[:90]}")
            con.commit()
            con.close()
            return self._json({"ok": True})
        con.close()
        return self._json({"error": "unknown endpoint"}, 404)


# ----- Telegram polling (optional, only if BOT_TOKEN set) -----
def bot_poll():
    if not BOT_TOKEN:
        return
    offset = 0
    print(f"[bot] polling as @{BOT_USERNAME} ... send /brief in Telegram", flush=True)
    import urllib.error
    while True:
        try:
            url = (f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
                   f"?timeout=25&offset={offset}")
            with urllib.request.urlopen(url, timeout=35) as r:
                data = json.loads(r.read().decode())
            for up in data.get("result", []):
                offset = up["update_id"] + 1
                msg = up.get("message") or {}
                chat = msg.get("chat", {}).get("id")
                text = (msg.get("text") or "").strip().lower()
                if not chat or not text.startswith("/"):
                    continue
                user = "marcus"
                if "priya" in text:
                    user = "priya"
                elif "dev" in text:
                    user = "dev"
                if text.startswith("/start"):
                    send_telegram(chat, "Hi! I'm Care-Bridge 🌱. Try /brief, /brief priya, /due")
                elif text.startswith("/brief") or text.startswith("/due"):
                    b = brief_for(user)
                    if not b.get("due"):
                        send_telegram(chat, f"{user}: nothing due right now ✅")
                    else:
                        lines = [f"Brief for {user} ({len(b['due'])} due):"]
                        for d in b["due"][:5]:
                            lines.append(f"• [{d['tier']}] {d['question']}")
                        lines.append(f"Open dashboard: http://localhost:{PORT}/?user={user}")
                        send_telegram(chat, "\n".join(lines))
        except Exception as e:
            print("[bot] poll error:", e, flush=True)
            time.sleep(5)


if __name__ == "__main__":
    init_db()
    if BOT_TOKEN:
        threading.Thread(target=bot_poll, daemon=True).start()
    else:
        print("[bot] TELEGRAM_BOT_TOKEN not set — dashboard + fake reminders still work.", flush=True)
    print(f"Care-Bridge on http://localhost:{PORT}  (db: {DB_PATH})", flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
