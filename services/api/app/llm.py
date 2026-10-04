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


def chat_json(system: str, user: str, schema: dict, timeout: float = 180.0, images: list[str] | None = None,
              temperature: float = 0) -> dict:
    body = {
        "model": settings.model,
        "stream": False,
        "format": schema,
        "options": {"temperature": temperature, "num_predict": 3000},  # stops a run-away generation instead of hanging
        "keep_alive": -1,
        "think": False,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user, **({"images": images} if images else {})}],
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


def grade_answer(question: str, approved_answer: str, caregiver_answer: str) -> dict:
    """C4: grade a typed answer as correct, partial or incorrect."""
    schema = {"type": "object",
              "properties": {"reason": {"type": "string"},
                             "grade": {"type": "string", "enum": ["correct", "partial", "incorrect"]}},
              "required": ["reason", "grade"]}
    system = ("You check a caregiver's answer to a flashcard about an older adult's care. Compare the caregiver's answer "
              "with the correct answer. First give a one-sentence reason. Grade \"correct\" if it has the same meaning, even "
              "with different words or abbreviations; \"partial\" if it is on the right track but missing an important "
              "detail; \"incorrect\" if it is wrong, unsafe, unrelated or blank.")
    r = chat_json(system, f"Question: {question}\nCorrect answer: {approved_answer}\nCaregiver's answer: {caregiver_answer}",
                  schema, timeout=60.0)
    return {"grade": r["grade"], "reason": r.get("reason", ""), "by": "gemma"}


def analyze_message(role: str, message: str, facts: list[dict], conditions: list[str], timeout: float = 10.0) -> dict:
    """Read one chat message: which fact it is about, and what the sender needs. Python decides what to do with it."""
    ids = [f["id"] for f in facts] + ["none"]
    listing = "\n".join(f"- {f['id']}: {f['label']}" for f in facts)
    if role == "older_adult":
        props = {
            "reason": {"type": "string"},
            "fact_id": {"type": "string", "enum": ids},
            "asks_for_person": {"type": "boolean"},
            "feeling_unwell": {"type": "boolean"},
            "emergency": {"type": "boolean"},
            "wants_to_be_shown": {"type": "boolean"},
            "guide_topic": {"type": "string"},
            "summary": {"type": "string"},
        }
        system = (
            f"You read a message from Ruth, an older adult with {', '.join(conditions)}, to her care companion. "
            "First write a one-sentence reason. Then:\n"
            "- fact_id: the care fact that best answers or relates to the message (symptoms count: swelling relates to "
            "weight gain from fluid), or \"none\".\n"
            "- asks_for_person: true only if she asks to contact, call, tell or get Priya, her family, a caregiver or "
            "someone to help her.\n"
            "- feeling_unwell: true if she says she feels ill, unwell, in pain, dizzy, scared or needs help.\n"
            "- emergency: true only for chest pain, fainting, a fall, severe trouble breathing or anything life-threatening.\n"
            "- wants_to_be_shown: true if she asks to be shown, asks how to do something, or says yes to a guide.\n"
            "- guide_topic: if she wants to be shown something, the task in a few words (e.g. \"call Priya on the phone\"), else \"\".\n"
            "- summary: one short sentence in the third person saying what Ruth said, for her family to read."
        )
    else:
        props = {
            "reason": {"type": "string"},
            "fact_id": {"type": "string", "enum": ids},
            "shares_new_care_info": {"type": "boolean"},
            "new_fact_text": {"type": "string"},
            "wants_guide": {"type": "boolean"},
            "guide_topic": {"type": "string"},
        }
        system = (
            "You read a message from a caregiver for Ruth, an older adult, to the Care-Bridge assistant. "
            "First write a one-sentence reason. Then:\n"
            "- fact_id: the handbook fact that best answers or relates to the message, or \"none\".\n"
            "- shares_new_care_info: true only if the caregiver states new information about Ruth's care that should be "
            "remembered (a routine, preference, medicine, symptom to watch, instruction). Questions are false.\n"
            "- new_fact_text: if true, the NEW information as one plain sentence about Ruth, written from the caregiver's "
            "message. Never copy a handbook fact; if it changes one, write the new version. Otherwise an empty string.\n"
            "- wants_guide: true if they ask for a visual, 3D or step-by-step guide, visualization or demo of a task.\n"
            "- guide_topic: if wants_guide, the task in a few words (e.g. \"using a phone to call Priya\"), else \"\"."
        )
    schema = {"type": "object", "properties": props, "required": list(props)}
    result = chat_json(system, f"Care facts:\n{listing}\n\nMessage: {message}", schema, timeout=timeout)
    if result.get("fact_id") not in ids or result.get("fact_id") == "none":
        result["fact_id"] = None
    return result


def read_health_record(image_b64: str, caption: str = "") -> dict:
    """Read a photo of a medical document (lab report, prescription, letter). Values are copied, never interpreted."""
    finding = {"type": "object",
               "properties": {"name": {"type": "string"}, "value": {"type": "string"}, "unit": {"type": "string"},
                              "reference_range": {"type": "string"},
                              "flag": {"type": "string", "enum": ["low", "high", "normal", "abnormal"]}},
               "required": ["name", "value", "unit", "reference_range", "flag"]}
    schema = {"type": "object",
              "properties": {"is_health_record": {"type": "boolean"}, "record_type": {"type": "string"},
                             "result_rows_in_document": {"type": "integer"},
                             "patient_name": {"type": "string"}, "date": {"type": "string"},
                             "source": {"type": "string"}, "ordered_by": {"type": "string"},
                             "findings": {"type": "array", "items": finding}, "summary": {"type": "string"}},
              "required": ["is_health_record", "record_type", "result_rows_in_document", "patient_name", "date",
                           "source", "ordered_by", "findings", "summary"]}
    system = ("You read a photo that a caregiver shared about Ruth, an older adult. is_health_record: true only for a "
              "medical document such as a lab report, prescription, discharge note or doctor's letter. record_type: what "
              "kind of document it is, e.g. \"Complete blood count (CBC)\". source: the hospital, lab or clinic. "
              "Copy every value exactly as printed; never guess or interpret. result_rows_in_document: count the result rows "
              "in the document's tables. findings: one entry for EVERY result row, normal ones included, so its length "
              "equals result_rows_in_document. flag: "
              "low or high if the document marks it L or H or it is outside the printed range, otherwise normal. "
              "summary: one plain sentence naming only what is out of range, with no medical advice.")
    return chat_json(system, f"Read this document.{' Caregiver note: ' + caption if caption else ''}", schema,
                     timeout=300.0, images=[image_b64])


KIT_KINDS = ["phone", "chair", "table", "bed", "cup", "kettle", "pill_box", "door", "keys", "glasses", "scale",
             "walker", "tv_remote", "clock", "lamp", "plate"]
BUTTON_COLORS = ["green", "red", "blue", "grey"]


def custom_guide(request: str, for_ruth: bool, related_fact: str | None, people: list[str]) -> dict:
    """Plan a short 3D guide from a fixed kit of objects. The renderer draws it; nothing here is code."""
    obj = {"type": "object", "properties": {"id": {"type": "string"}, "kind": {"type": "string", "enum": KIT_KINDS},
                                            "label": {"type": "string"}}, "required": ["id", "kind", "label"]}
    button = {"type": "object", "properties": {"id": {"type": "string"}, "label": {"type": "string"},
                                               "color": {"type": "string", "enum": BUTTON_COLORS}},
              "required": ["id", "label", "color"]}
    step = {"type": "object", "properties": {"text": {"type": "string"}, "focus": {"type": "string"},
                                             "action": {"type": "string", "enum": ["tap", "watch"]}},
            "required": ["text", "focus", "action"]}
    schema = {"type": "object",
              "properties": {"suitable": {"type": "boolean"}, "reason": {"type": "string"}, "title": {"type": "string"},
                             "objects": {"type": "array", "items": obj, "minItems": 1, "maxItems": 5},
                             "phone_buttons": {"type": "array", "items": button, "maxItems": 6},
                             "steps": {"type": "array", "items": step, "minItems": 2, "maxItems": 5}},
              "required": ["suitable", "reason", "title", "objects", "phone_buttons", "steps"]}
    who = "Ruth, an older adult with early memory loss" if for_ruth else "Ruth, an older adult, prepared by her caregiver"
    system = (
        f"You plan a very short step-by-step 3D guide for {who}. A fixed renderer draws it from a kit of objects: "
        f"{', '.join(KIT_KINDS)}. A phone object can show up to 6 large labelled buttons on its screen (phone_buttons). "
        "suitable: true only for practical everyday tasks with these objects (using a phone, making tea, taking pills "
        "from a pill box, finding keys, standing up). false for medical decisions, diagnoses or anything the kit cannot show.\n"
        "Rules: 2 to 5 steps. Each step is one calm sentence under 14 words, speaking to her as \"you\". Each step's "
        "focus is the id of one object or one phone button. Use \"tap\" when she should touch it, otherwise \"watch\". "
        "Give every object and button a short lowercase id like phone or call_priya. Title under 6 words. "
        "Use each kind at most once. Labels and step text are plain words a person reads, never ids. "
        "Example for calling someone: objects [phone], phone_buttons [{id: phone_app, label: Phone, color: blue}, "
        "{id: priya, label: Priya, color: grey}, {id: call, label: Call, color: green}], steps: tap Phone, tap Priya, "
        "tap the green Call button, wait for her to answer. "
        "Never add medical advice. If a care fact is given, follow it exactly and keep its numbers."
        + (f" People she may call: {', '.join(people)}." if people else "")
    )
    user = f"Request: {request}" + (f"\nRelated care fact: {related_fact}" if related_fact else "")
    try:
        return chat_json(system, user, schema, timeout=75.0)
    except json.JSONDecodeError:  # the model looped and hit the length cap; a little randomness usually breaks the loop
        return chat_json(system, user, schema, timeout=75.0, temperature=0.4)
