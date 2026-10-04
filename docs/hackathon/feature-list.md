# Care-Bridge feature list

Every feature in the Care-Bridge vision (see [the ideas doc](../ideas/ai-for-aging-populations.md), Idea 4), with the scope chosen for today's hackathon. The interface for caregivers is a **Telegram Mini App**, plus the bot chat for reminders.

**Today:**
- **Must** = the demo path depends on it; build first.
- **Stretch** = chosen for today; build after every Must works.
- **Fake** = shown in the demo with seeded or hard-coded data.
- **Cut** = not today.

**Effort:** S = a few hours, M = half a day, L = more than a day for a hackathon team.
**Reuse:** what the [FSRS coach prototype](../prototype/fsrs-coach-bot-one-pager.md) already has.

## Today's scope at a glance

| Today | Features |
|---|---|
| Must | A1, A2, A3, B1, B3, B5, B6, B7, C1, C2, C3, C4, C5, C6, D1, D3, F1, F2, F3 |
| Stretch | E7 first, E8 built in parallel by its own owner, then D5, B2, C7, C8, D4, B4, B8 (order from [the execution plan](execution-plan.md)) |
| Fake | D2, E3 |
| Cut | A4, A5, E1, E2, E4, E5, E6, F4, F5 |

## A. Care circle

| ID | Feature | What it does | Reuse | Effort | Today |
|---|---|---|---|---|---|
| A1 | Person profile | One older adult per circle: name, photo, conditions, key contacts | None | S | Must |
| A2 | Invite caregivers | Share a Telegram deep link; joining adds the caregiver to the circle | None | S | Must |
| A3 | Roles | Primary, family, aide, care manager; controls who can add or edit facts | None | S | Must (simple) |
| A4 | Shift schedule | Who is on shift when; drives brief timing | None | M | Cut |
| A5 | Consent and privacy controls | Who can see whose progress; older adult or proxy approves | None | M | Cut |

## B. Care handbook (fact store)

| ID | Feature | What it does | Reuse | Effort | Today |
|---|---|---|---|---|---|
| B1 | Add fact by text | Type a fact, pick a category, tier (warning sign, routine, nice to know) and audience | Learner-written cards | S | Must |
| B2 | Add facts from a voice note | Record in Telegram; transcribe; the model drafts facts for review | None | M | Stretch |
| B3 | Upload a document | Discharge PDF or care plan becomes draft facts the primary caregiver approves | PDF ingest and build | M | Must |
| B4 | Photo of a med list | Read a photo into draft facts with a vision model or OCR | None (prototype fails on image-only PDFs) | M | Stretch |
| B5 | Source on every fact | Who added it, when, and from which document | Event journal | S | Must |
| B6 | Browse and search handbook | Facts grouped by category: meds, allergies, routines, mobility, behaviour, contacts | None | S | Must |
| B7 | Edit a fact and flag the change | Editing marks the fact as changed for every caregiver | None | S | Must |
| B8 | General care lessons | Short lessons from trusted URLs (dementia communication, fall response) | Course from URL | M | Stretch |

## C. Learning (FSRS)

| ID | Feature | What it does | Reuse | Effort | Today |
|---|---|---|---|---|---|
| C1 | FSRS card per caregiver per fact | Each caregiver has their own schedule for each fact | Py-FSRS | S | Must |
| C2 | Pre-shift brief | Under 60 seconds: facts this caregiver is about to forget, plus changes since their last brief | Due-card query | M | Must (headline feature) |
| C3 | Question-first card | Question shown; answer revealed after an attempt; rated Didn't know, Partly, Knew it (Again, Hard, Good) | Study card flow | S | Must |
| C4 | Short-answer grading | Typed answer graded correct, partial or incorrect by the Laya decision model | Rubric grading | S | Must (self-rating if Laya is down) |
| C5 | Recall target by tier | 0.97 for warning signs, 0.9 for routine, 0.85 for nice to know | Scheduler setting | S | Must |
| C6 | Bot reminders | Telegram message when warning signs are due, opening the Mini App | Daily reminder cron | S | Must |
| C7 | My progress | What I know well, what I keep forgetting | Progress report | S | Stretch |
| C8 | Scenario card | "Tap the right object" card for caregivers, reusing Ruth's explainer player (E8) | E8 player | M | Stretch |

## D. Circle overview

| ID | Feature | What it does | Reuse | Effort | Today |
|---|---|---|---|---|---|
| D1 | Coverage view | For each warning sign, which caregivers reliably know it | FSRS retrievability | M | Must (strong demo moment) |
| D2 | Coverage alert | Warns the primary caregiver when no caregiver reliably knows a warning sign | None | M | Fake |
| D3 | "What changed" feed | Recent fact edits and new facts, newest first | Event journal | S | Must |
| D4 | Shift log and handoff notes | Caregivers leave notes for the next shift | Event journal | M | Stretch |
| D5 | Ask the handbook | Ask in chat ("what does Mom take at night?"); Laya picks the relevant fact and Gemma answers only from it | Course-grounded Q&A | M | Stretch |

## E. Older adult side (Episode and Companion modes)

| ID | Feature | What it does | Reuse | Effort | Today |
|---|---|---|---|---|---|
| E1 | 30-day discharge episode | Discharge PDF starts a 30-day plan for the older adult | PDF ingest | L | Cut |
| E2 | Daily recall phone calls | Short voice calls asking the older adult one to three questions | None | L | Cut |
| E3 | Responsibility shift | When the older adult keeps missing a fact, raise its recall target for caregivers | FSRS | M | Fake |
| E4 | Escalation alerts | Alert the circle when the older adult misses a warning sign twice | None | M | Cut |
| E5 | Memory companion | Daily conversations with practice woven in, photo cards, no "wrong" answers | None | L | Cut |
| E6 | Recall trend report | Months-long trend in the older adult's recall, shared with family | None | L | Cut |
| E8 | Explainer mini apps for Ruth | The bot sends a "Show me" button that opens a small Three.js explainer in Telegram; Gemma fills a JSON spec from an approved fact and a fixed player (built with threejs-game-skills) draws it | None | L | Stretch (parallel owner) |
| E7 | Companion answers from the care plan | Ruth asks the bot in Telegram; Laya picks the relevant approved fact meant for her; Gemma answers from it and asks before notifying Priya | `pre_llm_call` context hook | M | Stretch (first) |

## F. Platform

| ID | Feature | What it does | Reuse | Effort | Today |
|---|---|---|---|---|---|
| F1 | Telegram login | Validate Telegram `initData` on the server; no separate sign-up | None | S | Must |
| F2 | Backend API | Circles, facts, cards, reviews; Python so Py-FSRS stays the scheduler | Py-FSRS, SQLite | M | Must |
| F3 | Demo seed data | Ruth's circle: Priya, Marcus and Dev, about 15 facts, review history | None | S | Must |
| F4 | HIPAA-ready hosting | Business associate agreement, audit logs, encryption | None | L | Cut |
| F5 | SMS or WhatsApp | Other channels for caregivers not on Telegram | None | L | Cut |

**Shift schedule is cut**, so briefs and reminders run when facts are due, not at shift times. The brief's "changes since last time" uses the caregiver's last brief instead of their last shift.

## Demo path

1. Priya uploads Ruth's discharge PDF (B3) and approves the draft facts (B1, B5).
2. She invites Marcus with a link (A2).
3. Marcus gets a bot reminder (C6), opens his pre-shift brief (C2) and answers question-first cards (C3).
4. Priya edits a fact (B7); it appears in the "what changed" feed (D3) and in Marcus's next brief.
5. The coverage view (D1) shows which warning signs each caregiver knows. A seeded alert (D2) and a seeded responsibility shift (E3) show where the product goes next.
6. Ruth asks the bot about puffy ankles; it answers from her approved plan, opens a "Show me" explainer (E8) and, after she agrees, tells Priya (E7).
7. If other stretch features are ready, add them to the demo: a voice note or med-list photo (B2, B4), typed-answer grading (C4), or asking the handbook (D5).
