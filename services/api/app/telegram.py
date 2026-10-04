"""Telegram: Mini App initData validation and send-only Bot API calls.

Hermes is the only process that polls the bot. This module never calls getUpdates.
"""
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import parse_qsl

import httpx

from .config import settings

log = logging.getLogger("care-bridge.telegram")
MAX_AGE_SECONDS = 24 * 3600


def validate_init_data(init_data: str) -> dict | None:
    """Return {user, start_param} if initData was signed by our bot, else None."""
    if not init_data or not settings.bot_token:
        return None
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received = pairs.pop("hash", "")
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", settings.bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        return None
    if time.time() - int(pairs.get("auth_date", "0")) > MAX_AGE_SECONDS:
        return None
    try:
        user = json.loads(pairs.get("user", "{}"))
    except json.JSONDecodeError:
        return None
    return {"user": user, "start_param": pairs.get("start_param")}


def mini_app_url(path: str = "/") -> str | None:
    if not settings.public_url.startswith("https://"):
        return None
    return settings.public_url + path


def send_message(chat_id: int, text: str, button_text: str | None = None, path: str = "/") -> dict:
    if not settings.bot_token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN is not set"}
    body: dict = {"chat_id": chat_id, "text": text}
    url = mini_app_url(path) if button_text else None
    if url:
        body["reply_markup"] = {"inline_keyboard": [[{"text": button_text, "web_app": {"url": url}}]]}
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(f"https://api.telegram.org/bot{settings.bot_token}/sendMessage", json=body)
        result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return {"ok": False, "error": type(exc).__name__}
    if not result.get("ok"):
        log.warning("sendMessage failed: %s", result.get("description"))
        return {"ok": False, "error": result.get("description")}
    return {"ok": True, "button": bool(url)}


def send_document(chat_id: int, data: bytes, file_name: str, mime: str, caption: str = "") -> dict:
    if not settings.bot_token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN is not set"}
    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(f"https://api.telegram.org/bot{settings.bot_token}/sendDocument",
                                   data={"chat_id": str(chat_id), "caption": caption},
                                   files={"document": (file_name, data, mime)})
        result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return {"ok": False, "error": type(exc).__name__}
    return {"ok": bool(result.get("ok")), "error": result.get("description")}
