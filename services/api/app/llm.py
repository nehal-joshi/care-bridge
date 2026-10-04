"""Gemma through Ollama. Every call returns JSON validated against a schema; nothing it says is trusted unchecked."""
import json
import logging

import httpx

from .config import settings

log = logging.getLogger("care-bridge.llm")

CATEGORIES = ["medications", "allergies", "warning_signs", "routines", "mobility", "diet",
              "behaviour", "contacts", "appointments"]
TIERS = ["warning", "routine", "nice"]
AUDIENCES = ["everyone", "caregivers"]

_FACT_FIELDS = {
    "text": {"type": "string"},
    "question": {"type": "string"},
    "answer": {"type": "string"},
    "category": {"type": "string", "enum": CATEGORIES},
    "tier": {"type": "string", "enum": TIERS},
    "audience": {"type": "string", "enum": AUDIENCES},
}

GUIDE = """Fields:
- text: one self-contained care instruction about Ruth, under 30 words, in plain English.
- question: a short question a caregiver answers from memory, written as a realistic situation where possible.
- answer: the short correct answer, taken only from the text.
- category: one of medications, allergies, warning_signs, routines, mobility, diet, behaviour, contacts, appointments.
- tier: "warning" if missing it could cause harm or an emergency; "routine" for daily care; "nice" for comfort and preferences.
- audience: "everyone" if Ruth herself should also know it; "caregivers" if it is only for the people caring for her."""


def chat_json(system: str, user: str, schema: dict, timeout: float = 180.0) -> dict:
    body = {
        "model": settings.model,
        "stream": False,
        "format": schema,
        "options": {"temperature": 0},
        "keep_alive": -1,
        "think": False,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    with httpx.Client(timeout=timeout) as client:
        response = client.post(f"{settings.ollama_url}/api/chat", json=body)
        if response.status_code == 400 and "think" in response.text:
            body.pop("think")
            response = client.post(f"{settings.ollama_url}/api/chat", json=body)
        response.raise_for_status()
        content = response.json()["message"]["content"]
    return json.loads(content)


def draft_card(text: str) -> dict:
    """Turn one caregiver-written fact into a draft card."""
    schema = {"type": "object", "properties": _FACT_FIELDS, "required": list(_FACT_FIELDS)}
    system = ("You help a family caregiver turn a care note about Ruth (an older adult) into one flashcard. "
              "Use only information in the note. Never add medical advice.\n" + GUIDE)
    result = chat_json(system, f"Care note:\n{text}", schema)
    result["text"] = text.strip()
    return result


def extract_facts(document_text: str, existing: list[dict]) -> list[dict]:
    """Extract draft facts from a document and say whether each is new, already known, or an update."""
    item = {
        "type": "object",
        "properties": {
            **_FACT_FIELDS,
            "match": {"type": "string", "enum": ["new", "same", "update"]},
            "existing_fact_id": {"type": "string"},
        },
        "required": list(_FACT_FIELDS) + ["match", "existing_fact_id"],
    }
    schema = {"type": "object", "properties": {"facts": {"type": "array", "items": item}}, "required": ["facts"]}
    known = "\n".join(f"- {f['id']}: {f['text']}" for f in existing)
    system = (
        "You extract care instructions from a hospital discharge document for Ruth, an older adult. "
        "Extract only instructions a caregiver must remember: medicines and doses, things to stop, warning signs "
        "and who to call, diet and fluid limits, daily routines, mobility safety and appointments. "
        "Skip the hospital's address, the reason for the stay and anything not stated in the document. "
        "Use only the document's words and numbers; never invent or add advice.\n" + GUIDE + "\n"
        "- match: compare with the existing handbook facts. \"same\" if an existing fact already says this; "
        "\"update\" if an existing fact covers the same thing but the document changes it (for example a new dose); "
        "\"new\" otherwise.\n"
        "- existing_fact_id: the id of the matching existing fact for \"same\" or \"update\", otherwise an empty string."
    )
    user = f"Existing handbook facts:\n{known}\n\nDocument:\n{document_text}"
    result = chat_json(system, user, schema, timeout=300.0)
    return result.get("facts", [])


def explainer_steps(fact_text: str, template: str, objects: dict[str, str]) -> dict:
    """Fill a fixed explainer template with step text drawn only from the fact."""
    step = {
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "focus": {"type": "string", "enum": list(objects)},
            "action": {"type": "string", "enum": ["tap", "watch"]},
        },
        "required": ["text", "focus", "action"],
    }
    schema = {
        "type": "object",
        "properties": {"title": {"type": "string"},
                       "steps": {"type": "array", "items": step, "minItems": 2, "maxItems": 4}},
        "required": ["title", "steps"],
    }
    object_list = "\n".join(f"- {k}: {v}" for k, v in objects.items())
    system = (
        "You write a very short, calm, step-by-step explainer for Ruth, an older adult, shown in a simple 3D scene. "
        "Write 3 steps. Each step is one short sentence under 14 words, speaking to Ruth as \"you\". "
        "Use only what the care fact says; never add advice. Keep every number from the fact exactly as written, such as amounts, limits and phone numbers. "
        "Each step focuses on one scene object. Use \"tap\" when Ruth should touch the object and \"watch\" otherwise. "
        "The title is under 6 words."
    )
    user = f"Template: {template}\nScene objects:\n{object_list}\n\nCare fact:\n{fact_text}"
    return chat_json(system, user, schema)


def reachable() -> bool:
    try:
        with httpx.Client(timeout=3) as client:
            return client.get(f"{settings.ollama_url}/api/tags").status_code == 200
    except httpx.HTTPError:
        return False


def pick_fact(message: str, facts: list[dict], conditions: list[str] | None = None) -> str | None:
    """Fallback when Laya is down: ask Gemma which approved fact answers the message."""
    ids = [f["id"] for f in facts] + ["none"]
    schema = {"type": "object",
              "properties": {"reason": {"type": "string"}, "fact_id": {"type": "string", "enum": ids}},
              "required": ["reason", "fact_id"]}
    listing = "\n".join(f"- {f['id']}: {f['label']}" for f in facts)
    about = f"Ruth's conditions: {', '.join(conditions)}.\n" if conditions else ""
    system = ("You match a message from Ruth, an older adult, to her care plan. " + about +
              "First write a one-sentence reason: what symptom or need the message describes and which fact's "
              "instruction applies, given her conditions. Then pick that fact's id, or \"none\" if no fact applies.")
    choice = chat_json(system, f"Care facts:\n{listing}\n\nMessage: {message}", schema, timeout=30.0).get("fact_id")
    return choice if choice in ids and choice != "none" else None
