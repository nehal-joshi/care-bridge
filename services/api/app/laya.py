"""Laya decision model (Unsloth Decision API). Laya suggests; it never acts.

Every function returns None when Laya is unavailable, and callers fall back.
"""
import json
import logging
import re

import httpx

from .config import settings

log = logging.getLogger("care-bridge.laya")


def decide(state: dict | str, questions: dict, timeout: float = 4.0) -> dict | None:
    headers = {"Content-Type": "application/json"}
    if settings.laya_api_key:
        headers["Authorization"] = f"Bearer {settings.laya_api_key}"
    body = {"model": "laya", "state": state if isinstance(state, str) else json.dumps(state), "questions": questions}
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(f"{settings.laya_url}/v1/systemone", json=body, headers=headers)
            response.raise_for_status()
            return response.json().get("answers")
    except (httpx.HTTPError, ValueError) as exc:
        log.info("Laya unavailable: %s", exc)
        return None


def _choice(answer: dict | None) -> tuple[str | None, float]:
    if not answer:
        return None, 0.0
    probabilities = answer.get("probabilities") or {}
    choice = answer.get("choice")
    if choice is None and probabilities:
        choice = max(probabilities, key=probabilities.get)
    confidence = probabilities.get(choice, answer.get("confidence", 0.0)) if choice else 0.0
    return choice, float(confidence or 0.0)


def _noul(answer: dict | None) -> float | None:
    if not answer:
        return None
    if "noul" in answer:
        return float(answer["noul"])
    probabilities = answer.get("probabilities") or {}
    for key in ("yes", "true", "1"):
        if key in probabilities:
            return float(probabilities[key])
    return None


# Measured on the demo facts: only clearly correct answers scored at or above this, so Laya may fast-track
# "correct" but never marks anything wrong. Everything below goes to Gemma.
FAST_CORRECT_AT = 0.95


def grade_answer(question: str, approved_answer: str, caregiver_answer: str) -> dict | None:
    """C4 fast path: returns a "correct" grade when Laya is very sure, otherwise None (the caller asks Gemma)."""
    answers = decide(
        f"Question: {question}\nCorrect answer: {approved_answer}\nCaregiver's answer: {caregiver_answer}",
        {"correct": {"type": "noul", "instructions": "Is the caregiver's answer correct according to the correct answer?"}},
    )
    score = _noul((answers or {}).get("correct"))
    if score is not None and score >= FAST_CORRECT_AT:
        return {"grade": "correct", "confidence": round(score, 3), "by": "laya"}
    return None


def read_message(message: str, facts: list[dict]) -> dict | None:
    """E7 and D5: pick the approved fact that answers the message, and read the person's intent."""
    criteria = {f["id"]: f["label"] for f in facts}
    criteria["none"] = "none of these facts answers the message"
    answers = decide(
        message,
        {
            "fact": {"type": "choice", "instructions": "Which care fact best answers or relates to this message?",
                     "criteria": criteria},
            "intent": {"type": "choice", "instructions": "What does the person want?",
                       "criteria": {"care_question": "asks about their care, health, medicines or routine",
                                    "chat": "small talk or conversation",
                                    "wants_person": "asks for a family member or another person"}},
            "unsure": {"type": "noul", "instructions": "Does the person seem confused or unable to continue?"},
        },
    )
    if answers is None:
        return None
    fact_id, fact_confidence = _choice(answers.get("fact"))
    intent, intent_confidence = _choice(answers.get("intent"))
    return {
        "fact_id": None if fact_id in (None, "none") else fact_id,
        "fact_confidence": round(fact_confidence, 3),
        "intent": intent,
        "intent_confidence": round(intent_confidence, 3),
        "unsure": _noul(answers.get("unsure")),
        "by": "laya",
    }


_WORD = re.compile(r"[a-z0-9]+")
_STOP = set("the a an and or to of in on at for with is are be it its her his she he you your i my me what do does "
            "if when was were this that there should can not no".split())


def keyword_pick(message: str, facts: list[dict]) -> str | None:
    """Fallback when Laya is down: the fact sharing the most words with the message."""
    words = {w for w in _WORD.findall(message.lower()) if w not in _STOP}
    best, best_score = None, 0
    for f in facts:
        score = len(words & {w for w in _WORD.findall(f["label"].lower()) if w not in _STOP})
        if score > best_score:
            best, best_score = f["id"], score
    return best if best_score >= 1 else None


def reachable() -> bool:
    return decide("ping", {"ok": {"type": "noul", "instructions": "Is this a test?"}}, timeout=25.0) is not None
