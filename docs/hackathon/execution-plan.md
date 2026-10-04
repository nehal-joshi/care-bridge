# Care-Bridge hackathon execution plan

**Goal:** a working demo in 4 hours. Caregivers use a Telegram Mini App; Ruth (the older adult) chats with the same bot through Hermes.
**Scope:** [feature-list.md](feature-list.md). This plan builds every **Must** feature first, then the older-adult moment with its explainer mini app, then stretch features only if time is left.
**Team decisions:** one model, `gemma4:e4b-mlx`; the Laya decision model running locally through Unsloth; ngrok for HTTPS.
**Inputs:** ChatGPT's suggested architecture (reviewed below) and checks of the local machine.

## Stack and current state

| Piece | Role | State |
|---|---|---|
| Gemma 4 e4b (`gemma4:e4b-mlx`, 9.5 GB) on Ollama | Hermes chat, PDF-to-draft-facts, question and answer drafting | Running. Hermes currently defaults to `gemma4:12b-mlx`; switch it to e4b. |
| Laya decision model (Unsloth, multilingual, about 4 GB RAM) | Fast typed decisions: grading typed answers, picking the relevant fact for Ruth, reading her intent | **To install.** Served at `http://localhost:8888/v1/systemone`. |
| Hermes Agent | Telegram chat for Ruth, `care-bridge` plugin | Running. `pre_llm_call` receives `sender_id` and can inject context. |
| Py-FSRS 6.3.2 | Caregiver card scheduling, retrievability for coverage | In the prototype venv |
| ngrok | Public HTTPS URL for the Mini App | **To install.** Use a free static domain so the URL never changes. |
| Telegram bot | One bot for caregivers and Ruth | Running through Hermes with `allow_all_users: false`; add teammates to the allowlist |
| [threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) | Build-time skills for the coding agent that builds Ruth's explainer player (Vite + TypeScript + Three.js, mobile controls, Playwright tests) | **To install** on the explainer builder's machine |

### Memory budget (18 GB Mac)

| Process | Approximate RAM |
|---|---|
| Gemma e4b | 9.5 GB |
| Laya multilingual on CPU | 4 GB (Unsloth's figure) |
| Hermes, FastAPI, Vite, ngrok | 1–1.5 GB |
| macOS and everything else | What remains (about 3 GB) |

This fits only if nothing else heavy runs. On the demo Mac:
- Keep `gemma4:12b-mlx` unloaded (`ollama stop gemma4:12b-mlx`).
- Use phones for Telegram, not Telegram Desktop.
- Close extra browser tabs.
- Check Activity Monitor's memory pressure at checkpoint 1.

**Fallback if memory pressure turns red:** run Unsloth with Laya on a teammate's laptop on the same Wi-Fi and point `LAYA_URL` at it. Laya is just an HTTP API, so nothing else changes.

## Review of ChatGPT's plan

ChatGPT's plan gets the product boundaries right but adds more infrastructure than 4 hours allows. Keep its principles; cut the components the demo doesn't need.

| ChatGPT suggestion | Decision | Why |
|---|---|---|
| Hermes owns Telegram chat, sessions, voice and model calls; Care-Bridge owns circles, facts, FSRS and permissions | **Keep** | Clean split. Hermes already works; don't fork it. |
| One bot for both roles, role chosen by `sender_id` in a `pre_llm_call` plugin | **Keep** | Confirmed in the Hermes source: the hook receives `sender_id` and returns `{"context": ...}`. |
| Gemma may read approved facts and suggest drafts, but never approve them | **Keep** | Matches the feature list (B3, B5). This rule is the safety story. |
| FSRS stays separate from Hermes memory | **Keep** | Hermes memory is for conversation; FSRS measures caregiver recall. |
| "AI prediction is not permission": Laya and Gemma can suggest, but a person says yes and the backend acts | **Keep** | Laya never sends messages, approves facts or judges Ruth's health. |
| Older-adult interaction rules (short sentences, one thing at a time, help them do it themselves, never expose caregiver-only facts) | **Keep** | Goes into the Hermes prompt. See "Older adult interaction rules". |
| Mini App is the caregiver control panel, not a second chat app; no dashboard for the older adult | **Keep** | Agreed. |
| ScenarioSpec principle: the model emits JSON and a fixed renderer draws it; never run model-written code | **Keep the principle** | Applies to every model output here: extraction returns JSON that the backend validates. |
| Laya as a fast local decision model | **Keep (team decision), with a narrow job** | Three uses only: grading typed answers (C4), picking which approved fact answers Ruth's message, and reading her intent. Each call falls back cleanly if Laya is down. |
| Gemma on Modal; mixing model sizes | **Change: `gemma4:e4b-mlx` on Ollama only** | Already running locally. One model leaves room for Laya in 18 GB. |
| Three graphs (care, capability, caregiver knowledge) | **Change: SQLite tables, no capability graph** | The care "graph" is a facts table with categories; caregiver knowledge is the FSRS cards table. The capability graph (what Ruth can do on her phone) is outside today's scope. Don't call SQLite tables a graph in the pitch. |
| Hermes cron delivers caregiver reminders | **Change: backend sends them directly** | Reminders are deterministic. Putting an LLM agent in that path adds delay and the risk of reworded messages. The backend calls the Bot API `sendMessage` with an "Open brief" button; a demo button triggers it on stage. |
| Separate "Telegram bridge" service for Mini App buttons | **Change: fold into the backend; only send, never poll** | Only one process may poll a bot token, or Telegram returns 409 Conflict. Hermes polls; the backend only sends. Also set the bot's menu button to the Mini App in BotFather, which needs no code. |
| Three.js scenario renderer and the threejs-game-skills pack | **Keep for Ruth's side (team decision), as a fixed player plus JSON specs (E8)** | The skills are build-time tools for a coding agent, not runtime generators. A teammate uses them today to build one explainer player with two or three scene templates; Gemma only fills in a JSON spec per fact. Having e4b write Three.js code for each request would be slow, unreliable and unsafe to run on Ruth's phone. The caregiver 2D card (C8) can reuse the same player later. |
| HyperFrames videos | **Cut** | Not needed for the demo. |
| Older-adult moment: Ruth asks how to send Rahul a photo | **Change the example** | Phone-skills help is a different problem. Use a question answered from approved care facts; it ties to the handbook, coverage and the responsibility shift. |
| Five plugin tools | **Change: two tools** | Context arrives through `pre_llm_call`. Keep `carebridge_notify_circle` (called after Ruth says yes) and `carebridge_show_explainer` (sends her a "Show me" button). |
| Pitch listing every component | **Change** | Judges remember the problem and the demo. Lead with Ruth and Marcus; keep the tech to one slide. |

## Architecture for today

```text
Caregiver phone                         Ruth's phone
Telegram Mini App                       Telegram chat
      │ HTTPS (ngrok static domain)           │
      ▼                                       ▼
Vite (dev) or built app ──/api──► FastAPI ◄── Hermes gateway (only process polling the bot)
                                   │  ▲         │ pre_llm_call → POST /api/internal/ruth-context
                                   │  │         │ tool carebridge_notify_circle → POST /api/internal/notify
                     ┌─────────────┼──┴───────┐ ▼
                     ▼             ▼          Gemma 4 e4b (Ollama :11434)
              SQLite + Py-FSRS   Laya (Unsloth :8888)
                                   ▲
              FastAPI also calls Gemma for PDF extraction
              and the Bot API for reminders (send only)
```

Ruth's explainer player (E8) is a separate small Vite + Three.js app. FastAPI serves its build at `/explain/`, so it shares the ngrok domain and the BotFather Mini App with the caregiver app.

All Laya and database logic lives in FastAPI. The Hermes plugin stays thin: it calls the backend's internal endpoints and passes the result to Gemma. Everything runs on the demo Mac. Collaborators build the Mini App on their own machines against the ngrok URL.

### Repo layout

```text
apps/miniapp/                 Vite + React + TypeScript Mini App for caregivers
apps/explainer/               Vite + TypeScript + Three.js explainer player for Ruth (E8)
services/api/                 FastAPI, SQLite, Py-FSRS, Ollama and Laya clients
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
| `reviews` | member_id, fact_id, rating, answer_text, laya_grade, reviewed_at |
| `events` | id, person_id, type, actor, fact_id, details, created_at (feeds "What changed") |
| `explainers` | id, fact_id, fact_version, spec_json, created_at (one cached spec per fact version) |

Rules:
- Approving a fact creates one card per caregiver in its audience. A new member gets cards for every approved fact.
- Editing a fact increments `version`. A card whose `seen_version` is lower is "changed" and goes to the top of the next brief.
- Use one scheduler per tier: 0.97 for warning signs, 0.9 for routine, 0.85 for nice-to-know (C5).
- Every fact needs a question and answer for its card. Gemma drafts both during extraction or manual entry; the caregiver can edit them before approving.

### Laya: the three decisions

All calls go through one backend function, `decide(state, questions)`, which posts to `LAYA_URL/v1/systemone` with `"model": "laya"`. It has a 2-second timeout and returns `None` on any failure. Laya's multilingual model reads at most 1,024 tokens, so keep `state` short.

**1. Grade a typed answer (C4).** Used when a caregiver types an answer instead of tapping "Show answer."

```json
{
  "model": "laya",
  "state": {"question": "Ruth gains 3 lb overnight. What do you do?",
            "approved_answer": "Call the heart failure nurse.",
            "caregiver_answer": "phone her nurse"},
  "questions": {
    "grade": {"type": "choice",
              "instructions": "How well does caregiver_answer match approved_answer in meaning?",
              "criteria": {"correct": "same meaning, nothing important missing",
                           "partial": "partly right or missing an important detail",
                           "incorrect": "wrong, unrelated or blank"}}
  }
}
```

The grade maps to FSRS: `correct` → Good, `partial` → Hard, `incorrect` → Again. The card still shows the approved answer afterward. If Laya fails, the card falls back to the three self-rating buttons.

**2. Pick the relevant fact for Ruth (E7, and D5 for caregivers).** Each choice option is one approved fact meant for her (shown as a short label), plus `none`. The plugin injects only that fact, so Gemma never sees the whole handbook.

**3. Read Ruth's intent (E7).** In the same request as decision 2, add:
- `intent`, a choice between `care_question`, `chat` and `wants_person`.
- `unsure`, a yes/no question: "Does the person seem confused or unable to continue?"

These go into Gemma's context as hints. They never trigger actions on their own.

Laya never notifies anyone, approves a fact or concludes anything about Ruth's health.

### API contract (agree on this in the first 25 minutes)

Auth header: `X-Telegram-Init-Data`. The backend validates it with HMAC using the bot token. When `DEV_AUTH=1`, `X-Dev-User: priya|marcus|dev` is also accepted for browser development. Turn this off before the demo. Every `fetch` should also send the header `ngrok-skip-browser-warning: 1`.

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
| `POST /api/reviews` | `{fact_id, rating}` or `{fact_id, answer_text}`; Laya grades typed answers; Py-FSRS schedules | C1, C3, C4 |
| `GET /api/coverage` | For each warning fact, each caregiver's retrievability and status | D1, D2 |
| `GET /api/changes` | Recent events, newest first | D3 |
| `POST /api/demo/send-briefs` | Sends each caregiver a Telegram message with an "Open brief" button | C6 |
| `POST /api/demo/reset` | Reseeds the database | F3 |
| `POST /api/internal/ruth-context` | `{sender_id, message}` → context string with the relevant fact and Laya hints | E7 |
| `POST /api/internal/notify` | `{sender_id, fact_id, summary}` → messages the circle and logs an event | E7 |
| `POST /api/internal/explainer` | `{sender_id, fact_id}` → gets or creates the spec, then sends Ruth a "Show me" button that opens `/explain/?id=<id>` | E8 |
| `GET /api/explainers/{id}` | The validated spec JSON; Ruth and her circle only | E8 |
| `POST /api/explainers/{id}/done` | Logs "Ruth finished the explainer" for the Changes feed | E8 |

The `/api/internal/*` endpoints accept only requests from localhost with a shared secret, and are never exposed through ngrok paths the Mini App uses.

Rating buttons when nothing is typed: **Didn't know** maps to Again, **Partly** to Hard, **Knew it** to Good.

Coverage status (D1): **green** when retrievability is at or above the tier target, **amber** from 0.7 up to the target, **red** below 0.7 or never reviewed. The coverage alert (D2) can be real: show a banner when any warning fact has no green caregiver besides the primary.

## Older adult interaction rules (Hermes prompt for Ruth)

From ChatGPT's plan and the ideas doc:

- Use short, direct sentences. Ask one thing at a time. Offer no more than two choices.
- Help Ruth do things herself: let her try first, then give one small hint, then guide one step at a time.
- Answer only from the fact in the injected context. If there isn't one, say so and offer to ask Priya.
- Never mention caregiver-only facts. The backend filters them out before Gemma sees anything.
- Never quiz Ruth like a test, and never say "wrong."
- Never contact anyone without Ruth's yes. Only `carebridge_notify_circle` sends messages, and only after she agrees.
- Never give new medical advice. Repeat the care plan and point her to the nurse line.

## The older-adult moment (E7, built after the Must path works)

> **Ruth:** My ankles look puffy today. What was I supposed to do?
> **Bot:** Your care plan says to check your weight. Did the scale go up more than 3 pounds since yesterday?
> **Ruth:** Yes, about 4.
> **Bot:** Then the plan says to call the heart failure nurse at 555-0142. Want me to show you the weigh-in steps?
> **Ruth:** Yes.
> *(A "Show me" button arrives. Ruth taps it, and a three-step 3D explainer opens inside Telegram.)*
> **Bot:** Would you like me to let Priya know too?
> **Ruth:** Yes please.
> **Bot:** Done. Priya will see it now.

Behind the scenes:

1. Hermes's `pre_llm_call` sends the message to `/api/internal/ruth-context`.
2. Laya picks the weight-rule fact and returns `intent = care_question`.
3. The plugin injects that one fact, and Gemma writes the reply.
4. When Ruth asks to be shown, Gemma calls `carebridge_show_explainer`, and the backend sends the "Show me" button (E8).
5. After Ruth says yes to telling Priya, Gemma calls `carebridge_notify_circle`.
6. Priya's phone gets a Telegram message with an "Open Care-Bridge" button. In the Mini App, the weight rule shows the badge "Ruth asked about this today", tying into the responsibility shift (E3).

## Ruth's explainer mini apps (E8)

When words aren't enough, the bot offers Ruth a small interactive explainer inside Telegram, such as how to do her daily weigh-in.

### How "generated" works

1. **Built once, today:** a teammate uses threejs-game-skills with Claude Code or Codex to build one explainer player with two or three scene templates. Start with `/threejs-game-director` and scope it to "a calm, single-screen explainer player," not a game.
2. **Generated per fact:** Gemma turns an approved fact into a small JSON spec that picks a template and fills in the step text.
3. **Validated:** the backend checks that the template and object ids exist and that every step's text comes from the approved fact. Then it caches the spec by fact version.
4. **Delivered:** the backend sends Ruth a message with a "Show me" `web_app` button. Hermes can't send Mini App buttons, so this goes through the backend's send-only Bot API client.

Example spec:

```json
{
  "template": "weigh_in",
  "title": "Your morning weigh-in",
  "fact_id": "fact_weight_rule",
  "steps": [
    {"text": "Step on the scale before breakfast.", "focus": "scale", "action": "tap"},
    {"text": "Compare with yesterday's number.", "focus": "display", "action": "watch"},
    {"text": "Up more than 3 pounds? Call your heart failure nurse.", "focus": "phone", "action": "tap"}
  ]
}
```

### Templates for today

| Template | Scene | Fact it explains |
|---|---|---|
| `weigh_in` | Bathroom scale, number display, phone | The weight rule (used in the demo) |
| `stand_safely` | Chair, walker with brakes, "count to five" | Walker brakes before standing |
| `pill_box` (only if time) | Morning and evening pill organizer | Evening meds routine |

### Design rules for Ruth

- **Fixed camera.** No rotating or zooming, which confuses new users. One scene and one step per screen.
- **Large type.** At least 24 px text and a large "Next" button, with high contrast and Telegram's theme colours.
- **No fail state.** Tapping the wrong object gently highlights the right one. The explainer ends on "You did it" and a "Back to chat" button.
- **Slow motion.** Animations last a second or more, with no flashing.
- **Light scenes.** Low-poly shapes built in code, no downloaded 3D models, so it loads fast on older phones. If WebGL fails, show the same steps as large illustrated cards.
- **No paid generators today.** Skip `threejs-3d-generator`, `threejs-image-generator` and `threejs-audio-generator`; they need Tripo, Gemini and ElevenLabs keys.
- **Text only from the spec.** The player never shows text that isn't in the spec, and the spec's text comes only from the approved fact.

## Team and workstreams

The plan assumes four people. With five, give the explainer (E8) its own owner. With three, Nehal takes the seed data and demo script, and E8 is built only if the Must path is green by 2:30.

| Workstream | Owner | Builds | Features |
|---|---|---|---|
| W1 Backend | Python person | FastAPI, SQLite schema, initData auth, Py-FSRS, brief, coverage, changes, invites, seed loader, send-briefs, Laya client and grading | A1–A3, B1, B5–B7, C1–C6, D1, D3, F1–F3 |
| W2 Mini App | Frontend person (or two) | Vite + React + TS; Telegram WebApp SDK; screens: Brief, Handbook, Add, Coverage, Changes, Ruth's profile and circle | UI for all Must features |
| W3 Models and Hermes | Nehal (demo Mac) | Unsloth and Laya setup, ngrok, Gemma e4b settings, PDF extraction prompt and JSON schema, `care-bridge` plugin and internal endpoints, bot setup | B3, E7, setup |
| W4 Demo and explainer | Fourth person | Synthetic discharge PDF and seed facts first (done by 0:40), then Ruth's explainer player with threejs-game-skills, then demo script and backup recording | F3, E8, demo |

### Mini App screens

1. **Brief** (default for aides and family): up to five cards, changed facts first. Each card shows the question, an optional answer box (graded by Laya) or "Show answer", then the result.
2. **Handbook:** facts by category with search and source; drafts awaiting approval are shown to the primary caregiver.
3. **Add** (primary action): add by text, or upload a PDF to get draft facts, then approve.
4. **Coverage:** warning signs × caregivers grid with green, amber and red; alert banner (D2); responsibility-shift badge (E3).
5. **Changes:** feed of new and edited facts.
6. **Ruth:** profile, circle members, invite link.

Use Telegram's theme variables, call `Telegram.WebApp.ready()` and `expand()`, and use `MainButton` for the main action on each screen.

## Schedule

| Time | Everyone | W1 Backend | W2 Mini App | W3 Models and Hermes | W4 Demo |
|---|---|---|---|---|---|
| 0:00–0:25 | Agree on the API contract, repo layout, seed list and explainer spec format. Create folders. | Schema and stubs that return seed JSON | Vite scaffold, Telegram SDK, tab layout | Install ngrok and Unsloth; enable the Decision API; switch Hermes to e4b; BotFather Mini App and menu button; allowlist teammates | Write the synthetic discharge PDF (1–2 pages) and the 15 seed facts |
| 0:25–1:30 | | Auth, facts CRUD, approve, cards, reviews with Py-FSRS, brief, Laya grading with fallback; seed loader with backdated reviews | Handbook, Brief and card flow against stubs | Extraction prompt with JSON schema on e4b; question/answer drafting; `/api/documents` with W1 | From 0:40: install threejs-game-skills; build the explainer player and the `weigh_in` template against a hand-written spec |
| **1:30** | **Checkpoint 1:** Mini App opens inside Telegram on a real phone through ngrok; auth works; the handbook shows seed facts; one typed answer is graded by Laya; memory pressure checked | | | | |
| 1:30–2:30 | | Coverage, changes, invites and join, send-briefs; explainer endpoints and spec validation | Add (text and PDF), approve drafts, Coverage, Changes, profile | `care-bridge` plugin, internal endpoints, Laya fact picking, Gemma spec prompt; disable `study-coach` | `stand_safely` template; test the player in Telegram on iOS and Android |
| **2:30** | **Checkpoint 2:** the whole Must demo path works end to end on phones | | | | |
| 2:30–3:15 | Fix bugs from checkpoint 2 first | Coverage alert, responsibility badge | Polish, empty states, loading states | Older-adult moment end to end, including the "Show me" button | Connect the player to `/api/explainers/{id}`; demo script |
| **3:15** | **Feature freeze.** Stretch work only if every Must is green. If the explainer isn't working by now, drop it from the demo; the chat moment still works without it. | | | | |
| 3:15–3:45 | Rehearse twice. Record a backup video of the full demo. | | | | |
| 3:45–4:00 | Buffer and pitch | | | | |

Stretch order if time remains: D5 ask the handbook (reuses Laya fact picking), B2 voice note (Hermes already transcribes), C7 my progress, C8 2D scenario card, D4 shift log, B4 med-list photo, B8 general lessons.

## Setup checklist (W3, first 25 minutes)

**Models**
- [ ] `ollama stop gemma4:12b-mlx`. Set `default_model: gemma4:e4b-mlx` in `~/.hermes/config.yaml` and restart the gateway.
- [ ] Set `OLLAMA_KEEP_ALIVE=-1` so e4b stays warm, and run one request to load it.
- [ ] Install Unsloth: download from [unsloth.ai/download](https://unsloth.ai/download), or `curl -fsSL https://unsloth.ai/install.sh | sh`.
- [ ] In Unsloth, open Settings → API → Decision API, turn on **Serve requests**, and turn on **Keyless API access** for localhost. Keep the default multilingual model and CPU.
- [ ] Warm Laya with one request; Unsloth says the first takes 10–20 seconds.
- [ ] Smoke test:

  ```bash
  curl -s localhost:8888/v1/systemone -H 'Content-Type: application/json' -d '{"model":"laya","state":"I forgot what to do about my weight","questions":{"intent":{"type":"choice","criteria":{"care_question":"asks about their care","chat":"small talk","wants_person":"asks for a person"}}}}'
  ```

**HTTPS**
- [ ] Install ngrok (`brew install ngrok`), sign in at ngrok.com, and claim the free static domain.
- [ ] Add the authtoken yourself: `ngrok config add-authtoken <token>`. Keep it out of the repo and chat.
- [ ] Start the tunnel and keep it running all day: `ngrok http --url=<your-domain>.ngrok-free.app 5173`.
- [ ] Vite: set `server.allowedHosts: ['.ngrok-free.app']` and proxy `/api` to FastAPI on port 8000.
- [ ] ngrok's free plan shows a "You are about to visit" warning page the first time a browser opens the site. Open the Mini App once on every demo phone and tap **Visit Site** before the demo. API calls skip it with the `ngrok-skip-browser-warning` header.

**Telegram and Hermes**
- [ ] BotFather: create the Mini App (`/newapp`) and set the menu button to the ngrok URL. Optionally rename the bot (`/setname`, `/setuserpic`). Reuse the existing bot so Hermes needs no new token.
- [ ] Add teammates' Telegram user IDs to the Hermes allowlist, especially whoever plays Ruth.
- [ ] Put the bot token in `local.env` for the backend. It is git-ignored; never commit it or put it in the frontend.
- [ ] Explainer builder: review the threejs-game-skills repo, then install it for your coding agent, for example `npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a claude-code -g -y` (use `-a codex` for Codex).
- [ ] Before testing the older-adult moment, move `study-coach` from `plugins.enabled` to `plugins.disabled` in `~/.hermes/config.yaml` and restart the gateway.

## Seed data (W4)

- **Ruth Alvarez**, 78. Heart failure, early memory loss. Lives alone with daily aide visits.
- **Priya** (daughter, primary caregiver; Nehal's Telegram account), **Marcus** (weekday aide; a teammate's account), **Dev** (son, weekends; seeded only, no account needed). **Ruth** is played by a teammate's Telegram account.
- About 15 fictional facts across meds, allergies, routines, mobility, behaviour and contacts. Keep each fact under 25 words so Laya's 1,024-token limit fits Ruth's whole list. At least four should be warning signs, including:
  - the weight rule
  - a sulfa allergy
  - "walker brakes on before she stands"
  - "new confusion can mean a UTI; call Priya"
- Backdated reviews: Priya strong on everything; Dev strong on warning signs; Marcus weak on the weight rule. The coverage view should open with one red cell.
- Use only invented data. Screens and recordings will be shared.

## Demo script

The current script, covering daily logs and health records, is in [demo-script.md](demo-script.md).

## Risks and fallbacks

| Risk | Fallback |
|---|---|
| Memory pressure with e4b and Laya together | Close heavy apps; if still red, run Laya on a teammate's laptop and change `LAYA_URL` |
| Laya down or slow | Cards fall back to self-rating; Ruth's context falls back to a keyword match on her facts |
| e4b returns invalid JSON during extraction | Use Ollama's `format` JSON schema, keep the PDF to 1–2 pages, validate in Python and retry once |
| PDF extraction is slow on stage | Run it once during rehearsal and cache drafts by file hash; the demo path reuses the cached result |
| ngrok warning page appears on stage | Tap **Visit Site** on every demo phone beforehand; send the skip header on all API calls |
| Tunnel drops | Restart ngrok; the static domain keeps the same URL, so BotFather needs no change |
| Explainer slow or broken on an older phone | Low-poly scenes, no downloaded models; WebGL failure falls back to illustrated cards; pre-generate and cache the demo specs |
| Gemma's spec doesn't match a template | Backend validation rejects it and uses the hand-written spec for that template |
| Hermes reply goes off script | Keep Ruth's prompt rules strict; rehearse the exact wording; the backup video covers it |
| Telegram webview layout bugs | Test on both iOS and Android at checkpoint 1, not at the end |
| A teammate's Telegram account isn't allowlisted | Add every ID in the setup step and test by 1:30 |
