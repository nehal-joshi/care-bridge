"""Py-FSRS scheduling for caregiver cards. Py-FSRS is the only thing that sets due dates."""
import json
from datetime import datetime

from fsrs import Card, Rating, Scheduler

CAREGIVER_ROLES = ("primary", "family", "aide")

# Recall targets by tier (C5). A fact Ruth is no longer reliably holding is "shifted" to the circle.
RETENTION = {"warning": 0.97, "routine": 0.9, "nice": 0.85}
SHIFTED_RETENTION = 0.99

RATINGS = {"again": Rating.Again, "hard": Rating.Hard, "good": Rating.Good, "easy": Rating.Easy}

# Coverage colours: green when a caregiver very likely remembers, red when they likely don't.
GREEN_AT = 0.9
AMBER_AT = 0.7

_schedulers: dict[float, Scheduler] = {}


def scheduler_for(tier: str, shifted: bool = False) -> Scheduler:
    retention = SHIFTED_RETENTION if shifted else RETENTION.get(tier, 0.9)
    if retention not in _schedulers:
        # No intra-day learning steps: caregiver facts are reviewed in days, not minutes.
        _schedulers[retention] = Scheduler(
            desired_retention=retention, learning_steps=(), relearning_steps=(), enable_fuzzing=False
        )
    return _schedulers[retention]


def new_card_json() -> str:
    return Card().to_json()


def review(card_json: str, tier: str, shifted: bool, rating: str, at: datetime | None = None) -> str:
    card = Card.from_json(card_json)
    card, _ = scheduler_for(tier, shifted).review_card(card, RATINGS[rating], review_datetime=at)
    return card.to_json()


def card_state(card_json: str, at: datetime) -> dict:
    card = Card.from_json(card_json)
    reviewed = card.last_review is not None
    retrievability = scheduler_for("routine").get_card_retrievability(card, at) if reviewed else 0.0
    if not reviewed or retrievability < AMBER_AT:
        status = "red"
    elif retrievability < GREEN_AT:
        status = "amber"
    else:
        status = "green"
    return {
        "retrievability": round(retrievability, 3),
        "status": status,
        "due": card.due.isoformat(),
        "is_due": card.due <= at,
        "last_review": card.last_review.isoformat() if card.last_review else None,
        "stability": round(card.stability, 2) if card.stability else None,
    }


def audience_roles(audience: str) -> tuple[str, ...]:
    return CAREGIVER_ROLES + ("older_adult",) if audience == "everyone" else CAREGIVER_ROLES


def card_dump(card_json: str) -> dict:
    return json.loads(card_json)
