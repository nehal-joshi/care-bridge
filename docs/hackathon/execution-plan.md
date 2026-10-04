# Care-Bridge hackathon execution plan

**Goal:** a working demo in 4 hours. Caregivers use a Telegram Mini App; Ruth (the older adult) chats with the same bot through Hermes.
**Scope:** [feature-list.md](feature-list.md). This plan builds every **Must** feature first, then one older-adult moment, then stretch features only if time is left.
**Inputs:** ChatGPT's suggested architecture (reviewed below) and checks of the local machine.

## What's already running

| Piece | State | Notes |
|---|---|---|
| Ollama | Running `gemma4:e4b-mlx` (9.5 GB) and `gemma4:12b-mlx` (7.7 GB) | The Mac has **18 GB RAM**, so only one model can stay loaded |
| Hermes Agent | Gateway connected to Telegram and Ollama | `pre_llm_call` hook exists and receives `sender_id`; the `study-coach` plugin already uses it |
| Py-FSRS | 6.3.2 in the prototype venv | `Scheduler.get_card_retrievability()` is available for the coverage view |
| Telegram bot | Running through Hermes, `allow_all_users: false` | Teammates' accounts must be added to the allowlist |
| Tunnel | **Not installed** | A Mini App needs a public HTTPS URL; install `cloudflared` first |

## Review of ChatGPT's plan

ChatGPT's plan gets the product boundaries right but adds too much new infrastructure for 4 hours. Keep its principles; cut most of its new components.

| ChatGPT suggestion | Decision | Why |
|---|---|---|
| Hermes owns Telegram chat, sessions, voice and model calls; Care-Bridge owns circles, facts, FSRS and permissions | **Keep** | Clean split. Hermes already works; don't fork it. |
| One bot for both roles, role chosen by `sender_id` in a `pre_llm_call` plugin | **Keep** | Confirmed in the Hermes source: the hook receives `sender_id` and returns `{"context": ...}`. |
| Gemma may read approved facts and suggest drafts, but never approve them | **Keep** | Matches the feature list (B3, B5). This rule is the safety story. |
| FSRS stays separate from Hermes memory | **Keep** | Hermes memory is for conversation; FSRS measures caregiver recall. |
| "AI prediction is not permission": ask Ruth before contacting family; a deterministic backend sends the message | **Keep** | Good for dignity and safety. Used in the older-adult moment below. |
| Older-adult interaction rules (short sentences, one thing at a time, help them do it themselves, never expose caregiver-only facts) | **Keep** | Goes into the Hermes system prompt. See "Older adult interaction rules". |
| Mini App is the caregiver control panel, not a second chat app; no dashboard for the older adult | **Keep** | Agreed. |
| ScenarioSpec principle: the model emits JSON and a fixed renderer draws it; never run model-written code | **Keep the principle** | Applies to every model output here: extraction returns JSON that the backend validates. |
| Gemma on Modal for the demo, Ollama as fallback | **Change: Ollama only** | Ollama is already running. Modal adds deployment, auth and network risk with no demo benefit. |
| Use both Gemma models | **Change: one model loaded** | 9.5 GB + 7.7 GB won't both fit in 18 GB alongside the browser, Node, Python and Hermes. Benchmark both in the first 15 minutes and keep one. The 12b file is the smaller one. |
| Laya decision model (Unsloth, port 8888) for intent, "stuck" detection and grading | **Cut today** | Laya is real ([Unsloth decision models](https://unsloth.ai/docs/basics/api)), but it is another server competing for RAM. Up to five decisions per message add delay and failure points. A scripted demo moment doesn't need intent classification. Gemma with Ollama's JSON-schema output can grade answers (C4) if there is time. Revisit after the hackathon. |
| Three graphs (care, capability, caregiver knowledge) | **Change: two SQLite tables, no capability graph** | The care "graph" is a facts table with categories; caregiver knowledge is the FSRS cards table. The capability graph (what Ruth can do on her phone) is a new feature outside today's scope. Don't call SQLite tables a graph in the pitch. |
| Hermes cron delivers caregiver reminders | **Change: backend sends them directly** | Reminders are deterministic. Putting an LLM agent in that path adds delay and the risk of reworded messages. The backend calls the Bot API `sendMessage` with an "Open brief" button. A demo button triggers it on stage. |
| Separate "Telegram bridge" service for Mini App buttons | **Change: fold into the backend; only send, never poll** | Only one process may poll a bot token, or Telegram returns 409 Conflict. Hermes polls; the backend only sends. Also set the bot's menu button to the Mini App in BotFather, which needs no code. |
| Three.js scenario renderer and the threejs-game-skills pack in Hermes | **Cut; optional 2D version as last stretch (C8)** | A 3D scene in Telegram's mobile webview is a 4-hour project on its own. A 2D "tap the object" card driven by JSON gives most of the wow for a fraction of the time. |
| HyperFrames videos | **Cut** | Not needed for the demo. |
| Older-adult moment: Ruth asks how to send Rahul a photo | **Change the example** | Phone-skills help is a different problem from Care-Bridge's. Use a question answered from approved care facts instead. It ties directly to the handbook, coverage and the responsibility shift. |
| Five plugin tools (`get_context`, `record_learning_event`, `record_task_progress`, `request_human_help`, `get_active_task`) | **Change: one tool** | Context arrives through `pre_llm_call`, so no "get context" tool is needed. Keep only `carebridge_notify_circle`, called after Ruth says yes. |
| Pitch listing Hermes, Laya, Gemma, FSRS, Context Graph and Three.js | **Change** | Judges remember the problem and the demo. Lead with Ruth and Marcus; keep the tech to one slide. |

## Architecture for today

```text
Caregiver phone                      Ruth's phone
Telegram Mini App                    Telegram chat
      │ HTTPS (cloudflared tunnel)         │
      ▼                                    ▼
FastAPI backend ◄─────── SQLite ──────► Hermes gateway (polls the bot)
 · Telegram initData auth                  │ pre_llm_call: care-bridge plugin
 · facts, cards, reviews, coverage         │   looks up role by sender_id,
 · Py-FSRS scheduling                      │   injects approved facts for Ruth
 · PDF → draft facts (Ollama, JSON)        │ tool: carebridge_notify_circle
 · sends reminders (Bot API, send only)    ▼
      │                                 Gemma 4 (Ollama, one model)
      └──────────── Ollama ◄───────────────┘
```

Everything runs on the demo Mac. Collaborators build the Mini App on their own machines against the tunnel URL. For the demo, FastAPI serves the built Mini App, so everything comes from one HTTPS origin.

### Repo layout

```text
apps/miniapp/                 Vite + React + TypeScript Mini App
services/api/                 FastAPI, SQLite, Py-FSRS, Ollama client
hermes/plugins/care-bridge/   plugin source; deploy to ~/.hermes/plugins/care-bridge
demo/                         synthetic discharge PDF, seed data, demo script
docs/                         product and hackathon docs
```

### Data model (SQLite)

| Table | Key fields |
|---|---|
| `persons` | id, name, photo, conditions, contacts |
| `members` | id, person_id, telegram_id, name, role (`primary`, `family`, `aide`, `older_adult`) |
| `invites` | code, person_id, role, created_by, used_by |
| `facts` | id, person_id, text, question, answer, category, tier (`warning`, `routine`, `nice`), audience (list of roles or member ids), status (`draft`, `approved`), source, created_by, approved_by, version, updated_at |
| `cards` | member_id, fact_id, fsrs_card_json, seen_version |
| `reviews` | member_id, fact_id, rating, reviewed_at |
| `events` | id, person_id, type, actor, fact_id, details, created_at (feeds "What changed") |

Rules:
- Approving a fact creates one card per caregiver in its audience. A new member gets cards for every approved fact.
- Editing a fact increments `version`. A card whose `seen_version` is lower is "changed" and goes to the top of the next brief.
- Use one scheduler per tier: 0.97 for warning signs, 0.9 for routine, 0.85 for nice-to-know (C5).
- Every fact needs a question and answer for its card. Gemma drafts both during extraction or manual entry; the caregiver can edit them before approving.

### API contract (agree on this in the first 25 minutes)

Auth header: `X-Telegram-Init-Data`. The backend validates it with HMAC using the bot token. When `DEV_AUTH=1`, `X-Dev-User: priya|marcus|dev` is also accepted for browser development. Turn this off before the demo.

| Method and path | Returns or does | Features |
|---|---|---|
| `GET /api/me` | Member, role, person, circle members | A1, A3, F1 |
| `POST /api/invites` | `{link}`: `https://t.me/<bot>?startapp=<code>` | A2 |
| `POST /api/join` | Reads `start_param` from initData and joins the circle | A2 |
| `GET /api/facts?category=&q=` | Approved facts, plus drafts for the primary caregiver | B5, B6 |
| `POST /api/facts` | Add a fact (Gemma drafts the question and answer) | B1 |
| `PATCH /api/facts/{id}` | Edit; bumps version; logs an event | B7 |
| `POST /api/facts/{id}/approve` | Primary caregiver only; creates cards | B3, C1 |
| `POST /api/documents` | PDF upload; returns draft facts | B3 |
| `GET /api/brief` | `{changed: [...], due: [...]}`, at most 5 items, warning signs first | C2 |
| `POST /api/reviews` | `{fact_id, rating}`; Py-FSRS schedules the card | C1, C3 |
| `GET /api/coverage` | For each warning fact, each caregiver's retrievability and status | D1, D2 |
| `GET /api/changes` | Recent events, newest first | D3 |
| `POST /api/demo/send-briefs` | Sends each caregiver a Telegram message with an "Open brief" button | C6 |
| `POST /api/demo/reset` | Reseeds the database | F3 |

Rating buttons: caregivers aren't flashcard users, so show three buttons. **Didn't know** maps to Again, **Partly** to Hard, **Knew it** to Good.

Coverage status (D1): **green** when retrievability is at or above the tier target, **amber** from 0.7 up to the target, **red** below 0.7 or never reviewed. The coverage alert (D2) can be real: show a banner when any warning fact has no green caregiver besides the primary.

## Older adult interaction rules (Hermes system prompt for Ruth)

These come from ChatGPT's plan and the ideas doc:

- Use short, direct sentences. Ask one thing at a time. Offer no more than two choices.
- Help Ruth do things herself: let her try first, then give one small hint, then guide one step at a time.
- Answer only from facts in the injected context. If the answer isn't there, say so and offer to ask Priya.
- Never mention caregiver-only facts. The plugin filters them out before Gemma sees anything.
- Never quiz Ruth like a test, and never say "wrong."
- Never contact anyone without Ruth's yes. Only `carebridge_notify_circle` sends messages, and only after she agrees.
- Never give new medical advice. Repeat the care plan and point her to the nurse line.

## The older-adult moment (E7, built after the Must path works)

> **Ruth:** My ankles look puffy today. What was I supposed to do?
> **Bot:** Your care plan says to check your weight. Did the scale go up more than 3 pounds since yesterday?
> **Ruth:** Yes, about 4.
> **Bot:** Then the plan says to call the heart failure nurse at 555-0142. Would you like me to let Priya know too?
> **Ruth:** Yes please.
> **Bot:** Done. Priya will see it now.

Priya's phone then gets a Telegram message with an "Open Care-Bridge" button. In the Mini App, the weight rule shows the badge "Ruth asked about this today", tying into the responsibility shift (E3).

How it works: the `care-bridge` plugin's `pre_llm_call` looks up the role from `sender_id`. For Ruth, it injects only approved facts whose audience includes her. Gemma writes the reply, and the single tool `carebridge_notify_circle` asks the backend to message the circle.

## Team and workstreams

The plan assumes four people. With three, Nehal also takes W4.

| Workstream | Owner | Builds | Features |
|---|---|---|---|
| W1 Backend | Python person | FastAPI, SQLite schema, initData auth, Py-FSRS, brief, coverage, changes, invites, seed loader, send-briefs | A1–A3, B1, B5–B7, C1, C2, C5, C6, D1, D3, F1–F3 |
| W2 Mini App | Frontend person (or two) | Vite + React + TS; Telegram WebApp SDK; screens: Brief, Handbook, Add, Coverage, Changes, Ruth's profile and circle | UI for all Must features |
| W3 Models and Hermes | Nehal (demo Mac) | Model benchmark, Ollama settings, PDF-to-draft-facts prompt and JSON schema, question/answer drafting, `care-bridge` plugin, bot setup, tunnel | B3, E7, setup |
| W4 Demo | Fourth person | Synthetic discharge PDF, seed facts, demo script, pitch, phone testing, backup recording | F3, demo |

### Mini App screens

1. **Brief** (default for aides and family): up to five cards, changed facts first, question first, then reveal and rate.
2. **Handbook:** facts by category with search and source; drafts awaiting approval are shown to the primary caregiver.
3. **Add** (primary action): add by text, or upload a PDF to get draft facts, then approve.
4. **Coverage:** warning signs × caregivers grid with green, amber and red; alert banner (D2); responsibility-shift badge (E3).
5. **Changes:** feed of new and edited facts.
6. **Ruth:** profile, circle members, invite link.

Use Telegram's theme variables, call `Telegram.WebApp.ready()` and `expand()`, and use `MainButton` for the main action on each screen.

## Schedule

| Time | Everyone | W1 Backend | W2 Mini App | W3 Models and Hermes | W4 Demo |
|---|---|---|---|---|---|
| 0:00–0:25 | Agree on the API contract, repo layout and seed list. Create folders. | Schema and stubs that return seed JSON | Vite scaffold, Telegram SDK, tab layout | Install `cloudflared`, start the tunnel, BotFather menu button and Mini App, allowlist teammates, benchmark models | Write the synthetic discharge PDF (1–2 pages) and the 15 seed facts |
| 0:25–1:30 | | Auth, facts CRUD, approve, cards, reviews with Py-FSRS, brief | Handbook, Brief and card flow against stubs | Extraction prompt with JSON schema; question/answer drafting; `/api/documents` endpoint with W1 | Seed loader data with backdated reviews so coverage is mixed |
| **1:30** | **Checkpoint 1:** Mini App opens inside Telegram on a real phone, auth works, the handbook shows seed facts | | | | |
| 1:30–2:30 | | Coverage, changes, invites and join, send-briefs | Add (text and PDF), approve drafts, Coverage, Changes, profile | `care-bridge` plugin: role lookup, Ruth's context, notify tool; disable `study-coach` | Demo script; test every screen on iOS and Android |
| **2:30** | **Checkpoint 2:** the whole Must demo path works end to end on phones | | | | |
| 2:30–3:15 | Fix bugs from checkpoint 2 first | Coverage alert, responsibility badge | Polish, empty states, loading states | Older-adult moment end to end | Rehearse with the real flow |
| **3:15** | **Feature freeze.** Stretch work only if every Must is green. | | | | |
| 3:15–3:45 | Rehearse twice. Record a backup video of the full demo. | | | | |
| 3:45–4:00 | Buffer and pitch | | | | |

Stretch order if time remains: C4 grading with Gemma JSON output, D5 ask the handbook (Hermes plus the facts context), B2 voice note (Hermes already transcribes), C7 my progress, C8 2D scenario card, D4 shift log, B4 med-list photo, B8 general lessons.

## Setup checklist (W3, first 25 minutes)

- [ ] `brew install cloudflared`, then `cloudflared tunnel --url http://localhost:5173`. Keep it running all day; the URL changes on every restart.
- [ ] Vite: add the tunnel host to `server.allowedHosts` and proxy `/api` to FastAPI on port 8000.
- [ ] BotFather: create the Mini App (`/newapp`) and set the menu button URL to the tunnel. Optionally rename the bot to Care-Bridge (`/setname`, `/setuserpic`). Reuse the existing bot so Hermes needs no new token.
- [ ] Add teammates' Telegram user IDs to the Hermes allowlist, especially whoever plays Ruth.
- [ ] Benchmark both models on the extraction prompt and a short chat reply. Keep the faster one that gives valid JSON.
- [ ] Set `OLLAMA_MAX_LOADED_MODELS=1` and `OLLAMA_KEEP_ALIVE=-1`. Warm the model before the demo.
- [ ] Put the bot token in `local.env` for the backend. It is git-ignored; never commit it or paste it into the frontend.
- [ ] Before testing the older-adult moment, move `study-coach` from `plugins.enabled` to `plugins.disabled` in `~/.hermes/config.yaml` and restart the gateway.

## Seed data (W4)

- **Ruth Alvarez**, 78. Heart failure, early memory loss. Lives alone with daily aide visits.
- **Priya** (daughter, primary caregiver; Nehal's Telegram account), **Marcus** (weekday aide; a teammate's account), **Dev** (son, weekends; seeded only, no account needed). **Ruth** is played by a teammate's Telegram account.
- About 15 fictional facts across meds, allergies, routines, mobility, behaviour and contacts. At least four should be warning signs, including:
  - the weight rule
  - a sulfa allergy
  - "walker brakes on before she stands"
  - "new confusion can mean a UTI; call Priya"
- Backdated reviews: Priya strong on everything; Dev strong on warning signs; Marcus weak on the weight rule. The coverage view should open with one red cell.
- Use only invented data. Screens and recordings will be shared.

## Demo script (3 minutes)

1. **Problem (20 s):** Ruth has heart failure and early memory loss. Three people care for her. What matters lives in Priya's head.
2. **Priya adds the discharge PDF (40 s):** Gemma drafts facts with sources; Priya approves them.
3. **Marcus's brief (40 s):** the "Send briefs" button pushes Marcus a Telegram message. He opens a 60-second brief and misses the weight rule; FSRS brings it back sooner.
4. **Change (20 s):** Priya edits the evening-meds fact. It appears in Changes and at the top of Marcus's next brief.
5. **Coverage (30 s):** a grid of who reliably knows each warning sign, with an alert that only Priya knows the weight rule.
6. **Ruth (30 s):** Ruth asks the bot about puffy ankles. It answers from her approved plan and asks before telling Priya, and Priya's phone buzzes.
7. **Close (10 s):** "Care-Bridge makes sure the right person remembers the right thing when it matters."

## Risks and fallbacks

| Risk | Fallback |
|---|---|
| PDF extraction is slow on stage | Run it once during rehearsal and cache drafts by file hash; the demo path reuses the cached result |
| Tunnel drops | Restart it and update the BotFather URL (about 1 minute); the backup video covers the worst case |
| Model runs out of memory or stalls | One model loaded, warmed before the demo; close other heavy apps |
| Hermes reply goes off script | Keep Ruth's prompt rules strict; rehearse the exact wording; the backup video covers it |
| Telegram webview layout bugs | Test on both iOS and Android at checkpoint 1, not at the end |
| A teammate's Telegram account isn't allowlisted | Add every ID in the setup step and test by 1:30 |
