"""Daily schedules, the logs that tick them off, and weekly or monthly reports.

Dates are local calendar days on the machine running Care-Bridge. Times on schedules are local "HH:MM".
"""
import csv
import io
import random
import secrets
import sqlite3
from datetime import date, datetime, timedelta

from fpdf import FPDF

from .db import iso, log_event, now

CATEGORIES = {"medicine": "Medicine", "food": "Food and drink", "health": "Health check", "other": "Other"}
STATUSES = ("done", "skipped", "refused")
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def today() -> date:
    return datetime.now().astimezone().date()


def parse_day(value: str | None) -> date:
    return date.fromisoformat(value) if value else today()


def applies(schedule: dict, day: date) -> bool:
    days = (schedule.get("days") or "daily").lower()
    return days == "daily" or WEEKDAYS[day.weekday()] in days.split(",")


def schedules(conn: sqlite3.Connection, include_inactive: bool = False) -> list[dict]:
    sql = "SELECT * FROM schedules" + ("" if include_inactive else " WHERE active = 1") + " ORDER BY time, rowid"
    return [dict(r) for r in conn.execute(sql)]


def day_view(conn: sqlite3.Connection, day: date, names: dict[str, str]) -> dict:
    """Everything scheduled for one day, with its log if ticked, plus one-off entries."""
    logs = [dict(r) for r in conn.execute("SELECT * FROM logs WHERE date = ? ORDER BY logged_at", (day.isoformat(),))]
    by_schedule = {l["schedule_id"]: l for l in logs if l["schedule_id"]}
    for l in logs:
        l["logged_by_name"] = names.get(l["logged_by"], l["logged_by"])
    items = []
    for s in schedules(conn):
        if applies(s, day):
            items.append({"schedule": s, "log": by_schedule.get(s["id"])})
    # Ticks on schedule items that were later removed still show for that day.
    active_ids = {i["schedule"]["id"] for i in items}
    for l in logs:
        if l["schedule_id"] and l["schedule_id"] not in active_ids:
            old = conn.execute("SELECT * FROM schedules WHERE id = ?", (l["schedule_id"],)).fetchone()
            if old:
                items.append({"schedule": dict(old), "log": l})
    items.sort(key=lambda i: i["schedule"]["time"])
    extra = [l for l in logs if not l["schedule_id"]]
    done = sum(1 for i in items if i["log"] and i["log"]["status"] == "done")
    return {"date": day.isoformat(), "items": items, "extra": extra,
            "summary": {"done": done, "total": len(items),
                        "open": sum(1 for i in items if not i["log"])}}


def seed_schedules(conn: sqlite3.Connection, seed: dict, days_of_history: int = 13) -> None:
    """Insert the seed schedule and a believable history: mostly done, a few missed or refused."""
    rng = random.Random(7)
    person = seed["person"]["id"]
    t = iso(now())
    for s in seed.get("schedules", []):
        conn.execute(
            "INSERT OR IGNORE INTO schedules (id, person_id, category, title, details, time, days, active, created_by,"
            " created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,'priya',?,?)",
            (s["id"], person, s["category"], s["title"], s["details"], s["time"], s.get("days", "daily"), t, t),
        )
    base = today()
    clock = datetime.now().astimezone()
    for back in range(days_of_history, -1, -1):
        day = base - timedelta(days=back)
        weekend = day.weekday() >= 5
        for s in seed.get("schedules", []):
            hour, minute = (int(x) for x in s["time"].split(":"))
            when = datetime.combine(day, datetime.min.time()).replace(hour=hour, minute=minute).astimezone()
            if back == 0 and when > clock - timedelta(minutes=30):
                continue  # today: only what's already past has been ticked
            who = "dev" if weekend else ("marcus" if hour < 14 else "priya")
            roll = rng.random()
            if s["id"] == "s_metoprolol" and roll < 0.12:
                status, note = "refused", "Refused at first; took it later with pudding."
            elif roll < 0.06:
                continue  # missed: nobody ticked it
            elif s["category"] == "other" and roll < 0.2:
                status, note = "skipped", "Raining, so we did chair exercises instead."
            else:
                status, note = "done", None
            at = when + timedelta(minutes=rng.randint(0, 25))
            conn.execute(
                "INSERT OR IGNORE INTO logs (person_id, date, schedule_id, category, title, status, note, logged_by,"
                " logged_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (person, day.isoformat(), s["id"], s["category"], s["title"], status, note, who, iso(at), iso(at)),
            )
        if back % 3 == 1:
            weight = 160 + rng.choice([0, 0.4, -0.2, 0.8, 1.2])
            at = datetime.combine(day, datetime.min.time()).replace(hour=7, minute=50).astimezone()
            conn.execute(
                "INSERT INTO logs (person_id, date, schedule_id, category, title, status, note, logged_by, logged_at,"
                " updated_at) VALUES (?,?,NULL,'health','Weight',?,?,?,?,?)",
                (person, day.isoformat(), "done", f"{weight:.1f} lb", "dev" if day.weekday() >= 5 else "marcus",
                 iso(at), iso(at)),
            )


def context_lines(conn: sqlite3.Connection, names: dict[str, str], for_ruth: bool) -> list[str]:
    """Today's checklist for the chat assistant."""
    view = day_view(conn, today(), names)
    s = view["summary"]
    lines = [f"TODAY'S CHECKLIST ({view['date']}, {s['done']} of {s['total']} done):"]
    for i in view["items"]:
        sc, lg = i["schedule"], i["log"]
        if for_ruth and sc["category"] not in ("medicine", "food", "health"):
            continue
        if lg:
            state = f"{lg['status']} by {lg['logged_by_name']} at {_local_time(lg['logged_at'])}"
            if lg.get("note"):
                state += f" ({lg['note']})"
        else:
            state = "not ticked yet"
        # Schedule details are written for caregivers (e.g. how to coax her pills), so Ruth only sees names.
        details = f" – {sc['details']}" if sc["details"] and not for_ruth else ""
        note_free = state.split(" (")[0] if for_ruth else state
        lines.append(f"- {sc['time']} {CATEGORIES.get(sc['category'], sc['category'])}: {sc['title']}{details} → {note_free}")
    for e in view["extra"]:
        lines.append(f"- Logged: {e['title']} {e['note'] or ''} by {e['logged_by_name']} at {_local_time(e['logged_at'])}")
    return lines


def _local_time(value: str) -> str:
    return datetime.fromisoformat(value).astimezone().strftime("%H:%M")


# ---------- reports ----------

def period_range(period: str, end: date | None = None) -> tuple[date, date]:
    end = end or today()
    days = 7 if period == "week" else 30
    return end - timedelta(days=days - 1), end


def report_data(conn: sqlite3.Connection, start: date, end: date, names: dict[str, str]) -> dict:
    days = [start + timedelta(days=n) for n in range((end - start).days + 1)]
    all_schedules = schedules(conn, include_inactive=True)
    logs = [dict(r) for r in conn.execute("SELECT * FROM logs WHERE date BETWEEN ? AND ? ORDER BY date, logged_at",
                                          (start.isoformat(), end.isoformat()))]
    by_key = {(l["schedule_id"], l["date"]): l for l in logs if l["schedule_id"]}
    rows, missed, notes = [], [], []
    for s in all_schedules:
        created = s["created_at"][:10]
        expected = [d for d in days if applies(s, d) and (s["active"] or (s["id"], d.isoformat()) in by_key)
                    and d.isoformat() >= min(created, start.isoformat())]
        if not expected:
            continue
        counts = {"done": 0, "skipped": 0, "refused": 0, "missed": 0}
        for d in expected:
            l = by_key.get((s["id"], d.isoformat()))
            if not l:
                if d < today() or (d == today() and s["time"] < datetime.now().astimezone().strftime("%H:%M")):
                    counts["missed"] += 1
                    missed.append((d, s))
                continue
            counts[l["status"]] = counts.get(l["status"], 0) + 1
            if l.get("note"):
                notes.append((d, s["title"], l["status"], l["note"], names.get(l["logged_by"], l["logged_by"])))
        due = counts["done"] + counts["skipped"] + counts["refused"] + counts["missed"]
        rows.append({"schedule": s, **counts, "due": due,
                     "rate": round(100 * counts["done"] / due) if due else None})
    by_person: dict[str, int] = {}
    for l in logs:
        by_person[names.get(l["logged_by"], l["logged_by"])] = by_person.get(names.get(l["logged_by"], l["logged_by"]), 0) + 1
    extra = [l for l in logs if not l["schedule_id"]]
    return {"start": start, "end": end, "rows": rows, "missed": missed, "notes": notes, "extra": extra,
            "by_person": by_person}


def _latin1(text: str) -> str:
    return (text or "").replace("–", "-").replace("—", "-").replace("’", "'").replace("“", '"').replace("”", '"') \
        .encode("latin-1", "replace").decode("latin-1")


def report_pdf(data: dict, person_name: str) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 9, _latin1(f"Care-Bridge report: {person_name}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"{data['start']:%d %b %Y} to {data['end']:%d %b %Y}  ·  generated {datetime.now():%d %b %Y %H:%M}".replace("·", "-"),
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Schedule completion", new_x="LMARGIN", new_y="NEXT")
    widths = (46, 28, 14, 14, 17, 17, 16, 24)
    headers = ("Item", "Category", "Time", "Done", "Skipped", "Refused", "Missed", "Completion")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(235, 238, 242)
    for w, h in zip(widths, headers):
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Helvetica", "", 9)
    for r in data["rows"]:
        s = r["schedule"]
        title = s["title"] + ("" if s["active"] else " (removed)")
        cells = (title[:29], CATEGORIES.get(s["category"], s["category"])[:16], s["time"], r["done"], r["skipped"],
                 r["refused"], r["missed"], f"{r['rate']}%" if r["rate"] is not None else "-")
        if r["rate"] is not None and r["rate"] < 80:
            pdf.set_text_color(180, 35, 24)
        for w, c in zip(widths, cells):
            pdf.cell(w, 6, _latin1(str(c)), border=1)
        pdf.set_text_color(0, 0, 0)
        pdf.ln()
    pdf.ln(4)

    def section(title: str, lines: list[str]) -> None:
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        if not lines:
            pdf.cell(0, 6, "None.", new_x="LMARGIN", new_y="NEXT")
        for line in lines:
            pdf.multi_cell(0, 5.5, _latin1(line), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    section("Missed (not ticked)", [f"{d:%a %d %b}: {s['time']} {s['title']}"
                                    for d, s in sorted(data["missed"], key=lambda x: (x[0], x[1]["time"]))][:60])
    section("Notes, refusals and skips", [f"{d:%a %d %b}: {t} - {st} ({who}): {n}"
                                          for d, t, st, n, who in sorted(data["notes"], key=lambda x: x[0])][:60])
    section("Other entries", [f"{e['date']}: {e['title']} {e['note'] or ''}" for e in data["extra"]][:60])
    section("Who logged", [f"{who}: {n} entries" for who, n in sorted(data["by_person"].items(), key=lambda x: -x[1])])
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 4, "Demo data. Ruth Alvarez and her circle are fictional.")
    return bytes(pdf.output())


def report_csv(conn: sqlite3.Connection, start: date, end: date, names: dict[str, str]) -> bytes:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["date", "time", "category", "item", "details", "status", "note", "logged_by", "logged_at"])
    scheds = {s["id"]: s for s in schedules(conn, include_inactive=True)}
    for l in conn.execute("SELECT * FROM logs WHERE date BETWEEN ? AND ? ORDER BY date, logged_at",
                          (start.isoformat(), end.isoformat())):
        s = scheds.get(l["schedule_id"], {})
        writer.writerow([l["date"], s.get("time", ""), l["category"], l["title"], s.get("details", ""), l["status"],
                         l["note"] or "", names.get(l["logged_by"], l["logged_by"]), l["logged_at"]])
    return out.getvalue().encode()


def new_schedule_id() -> str:
    return f"s_{secrets.token_hex(4)}"


def log_schedule_event(conn, person_id: str, kind: str, actor: str, schedule: dict, before: dict | None = None) -> None:
    detail = {"title": schedule["title"], "time": schedule["time"], "details": schedule.get("details") or "",
              "category": schedule["category"]}
    if before:
        detail["before"] = f"{before['time']} {before['title']} ({before.get('details') or ''})"
        detail["after"] = f"{schedule['time']} {schedule['title']} ({schedule.get('details') or ''})"
    log_event(conn, person_id, kind, actor, None, detail)

