"""Care-Bridge Hermes plugin.

The plugin stays thin. Before each Telegram turn it asks the Care-Bridge API who is speaking and which approved
fact is relevant, and injects that as context. Its two tools ask the API to act; the API decides and sends.
Gemma never reads the database and never sends Telegram messages itself.
"""
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

log = logging.getLogger("care-bridge.plugin")

API_URL = os.environ.get("CAREBRIDGE_API_URL", "http://127.0.0.1:8000").rstrip("/")
ROOT = Path(os.environ.get("CAREBRIDGE_ROOT", Path.home() / "Documents/Claude/Projects/care-bridge"))
SECRET_FILE = ROOT / "services" / "api" / "data" / "internal_secret"

# Tool handlers receive the session id but not the sender, so remember who each session belongs to.
_SENDER_BY_SESSION: dict[str, str] = {}
# Photos a sender just sent: the reply hook tells Gemma a record is being saved. Expires after a few minutes.
_PHOTO_AT: dict[str, float] = {}
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".heic")


def _secret() -> str:
    configured = os.environ.get("CAREBRIDGE_INTERNAL_SECRET")
    if configured:
        return configured
    try:
        return SECRET_FILE.read_text().strip()
    except OSError:
        return ""


def _post(path: str, payload: dict, timeout: float = 30.0) -> dict:
    request = urllib.request.Request(
        API_URL + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-Internal-Secret": _secret()},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        log.warning("Care-Bridge API call %s failed: %s", path, exc)
        return {"ok": False, "error": "Care-Bridge is unavailable right now"}


def _on_message(event=None, **kwargs):
    """pre_gateway_dispatch: when a photo arrives, read it in the background so Hermes isn't held up.

    Reading a document photo takes Gemma about 40 seconds, longer than a reply hook may run, so the API reads it
    on its own thread and confirms in the chat when it's saved. Always returns None so the message is handled normally.
    """
    try:
        source = getattr(event, "source", None)
        platform = getattr(getattr(source, "platform", None), "value", "")
        sender = str(getattr(event, "user_id", None) or getattr(source, "user_id", "") or "")
        paths = [u for u, t in zip(getattr(event, "media_urls", []) or [],
                                   (getattr(event, "media_types", []) or []) + [""] * 10)
                 if str(t).startswith("image/") or str(u).lower().endswith(IMAGE_EXTS)]
        if platform != "telegram" or not sender or not paths:
            return None
        _PHOTO_AT[sender] = time.time()
        payload = {"sender_id": sender, "paths": paths, "caption": getattr(event, "text", "") or ""}
        threading.Thread(target=_post, args=("/api/internal/image", payload, 400.0), daemon=True).start()
    except Exception as exc:  # never break message handling
        log.warning("care-bridge photo hook failed: %s", exc)
    return None


def _care_bridge_context(**kwargs):
    if str(kwargs.get("platform") or "") not in ("telegram", ""):
        return None
    sender_id = str(kwargs.get("sender_id") or "")
    session_id = str(kwargs.get("session_id") or "")
    message = kwargs.get("user_message")
    if not sender_id:
        return None
    if session_id:
        _SENDER_BY_SESSION[session_id] = sender_id
    pending = time.time() - _PHOTO_AT.pop(sender_id, 0) < 300
    result = _post("/api/internal/context",
                   {"sender_id": sender_id, "message": message if isinstance(message, str) else "",
                    "image_pending": pending}, timeout=25.0)
    if not result.get("role") or not result.get("context"):
        return None
    return {"context": result["context"]}


def _sender(kwargs: dict) -> str:
    return _SENDER_BY_SESSION.get(str(kwargs.get("session_id") or ""), "")


def _handle_notify(args: dict, **kwargs) -> str:
    sender = _sender(kwargs)
    if not sender:
        return json.dumps({"ok": False, "error": "Unknown sender"})
    result = _post("/api/internal/notify", {
        "sender_id": sender,
        "summary": str(args.get("summary", "")),
        "fact_id": args.get("fact_id") or None,
    })
    if result.get("ok") and result.get("already_told"):
        return json.dumps({"ok": True, "message": "Ruth's circle was already told a few minutes ago."})
    if result.get("ok"):
        return json.dumps({"ok": True, "message": f"Told: {', '.join(result.get('told') or []) or 'her circle'}."})
    return json.dumps(result)


def _handle_show_explainer(args: dict, **kwargs) -> str:
    sender = _sender(kwargs)
    if not sender:
        return json.dumps({"ok": False, "error": "Unknown sender"})
    result = _post("/api/internal/explainer", {"sender_id": sender, "fact_id": str(args.get("fact_id", ""))}, timeout=90.0)
    if result.get("ok"):
        return json.dumps({"ok": True, "message": "A 'Show me' button has been sent in this chat. Tell Ruth to tap it."})
    return json.dumps(result)


NOTIFY_SCHEMA = {
    "name": "carebridge_notify_circle",
    "description": (
        "Tell Ruth's caregivers (Priya and her circle) about something Ruth said. "
        "Call this ONLY after Ruth has clearly said yes to letting Priya know. Never call it on your own judgement."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "One or two plain sentences: what Ruth reported, in her words where possible."},
            "fact_id": {"type": "string", "description": "The id of the CARE FACT in your context that this is about, if any."},
        },
        "required": ["summary"],
        "additionalProperties": False,
    },
}

EXPLAINER_SCHEMA = {
    "name": "carebridge_show_explainer",
    "description": (
        "Send Ruth a 'Show me' button that opens a short step-by-step visual guide for one care fact. "
        "Use only for a fact your context says has an explainer, and only after Ruth wants to be shown."
    ),
    "parameters": {
        "type": "object",
        "properties": {"fact_id": {"type": "string", "description": "The CARE FACT id from your context."}},
        "required": ["fact_id"],
        "additionalProperties": False,
    },
}


def register(ctx):
    ctx.register_tool(name="carebridge_notify_circle", toolset="care_bridge", schema=NOTIFY_SCHEMA, handler=_handle_notify)
    ctx.register_tool(name="carebridge_show_explainer", toolset="care_bridge", schema=EXPLAINER_SCHEMA,
                      handler=_handle_show_explainer)
    register_hook = getattr(ctx, "register_hook", None)
    if callable(register_hook):
        register_hook("pre_llm_call", _care_bridge_context)
        register_hook("pre_gateway_dispatch", _on_message)
