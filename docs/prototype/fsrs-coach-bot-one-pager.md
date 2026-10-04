# FSRS learning coach bot — recreation brief

Use this as the prompt or extra context for rebuilding the project. It describes the current personal prototype: one learner, one machine, Hermes Agent as the conversation layer, a local Gemma model on Ollama, official Py-FSRS for scheduling, and Telegram as the chat app.

**Status:** single-learner prototype in active testing. Not a multi-user service.

## What it is

A Telegram study bot that does two jobs:

1. **Personal Tutor.** Turn a topic, URL, or text PDF into a source-grounded course of short lessons and quizzes. Walk the learner through one lesson, then one question, and schedule each quiz item with FSRS.
2. **Study Coach.** Keep a separate deck of learner-written flashcards. Show the front, hide the answer until an attempt, then schedule that card with FSRS.

The learner talks in ordinary language. The model decides which tool to call. Python and FSRS own files, grades, and due dates. The model never invents the next lesson, a review interval, or a stored rating.

## Stack

| Piece | Role | Notes |
|---|---|---|
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | Agent, tools, skills, Telegram gateway | MIT. Local long polling. Allowlist one Telegram user. Do not put the bot token in the repo. |
| Ollama + Gemma 4 | Conversation, course writing, tool choice | OpenAI-compatible API at `http://127.0.0.1:11434/v1`. This install uses `gemma4:12b-mlx` or `gemma4:e4b-mlx`. Low reasoning effort. |
| [Py-FSRS](https://github.com/open-spaced-repetition/py-fsrs) `fsrs` 6.x | Card scheduling | MIT. Ratings Again=1, Hard=2, Good=3, Easy=4. Desired retention `0.9`. Course cards may use the scheduler in `fsrs_store.py`. Standalone cards use `Scheduler(enable_fuzzing=False)` so demos are reproducible. |
| Telegram | Chat app | Hermes gateway. Markdown only. No LaTeX. Math is plain text or Unicode (`7/2`, `(a+b)/(c+d)`, `x²`). |
| Python 3 | Tutor CLI and plugin | Skill-owned `.venv`. Dependencies: `fsrs`, `httpx`, `beautifulsoup4`, `readability-lxml`, `pdfplumber`, `pypdf`. |

Any Hermes-supported chat app can replace Telegram if the same tools and `telegram` text field are used. The formatter and length cap (about 3,500 characters) assume a phone chat.

## Architecture

```text
Learner message (Telegram)
  → Hermes gateway
  → Gemma, with injected learner context
  → one study_coach tool, or a normal reply if the message is not study
  → plugin handler
       course tools shell out to personal-tutor CLI (tutor.py)
       card tools update SQLite through Py-FSRS
  → JSON result; the chat shows only the telegram field
```

Repo layout (copy into the live Hermes home before it runs):

```text
.hermes/skills/learning/personal-tutor/   # CLI, generation, grading, FSRS course cards, SKILL.md
.hermes/plugins/study-coach/              # plugin.yaml, __init__.py, guidance skills
docs/                                     # this brief and operator notes
```

Live paths, not the repo mirror:

- Skill: `~/.hermes/skills/learning/personal-tutor/`
- Plugin: `~/.hermes/plugins/study-coach/`
- CLI: `~/.local/bin/personal-tutor` → skill `scripts/personal-tutor`, which re-execs the skill `.venv` Python
- Data: skill `data/`, or `TUTOR_ROOT` if set

Hermes loads plugins from `~/.hermes/plugins/` at gateway start. A tool the model must call by name has to be registered with `ctx.register_tool(name, toolset, schema, handler)` and enabled for the Telegram platform. Names are underscores (`personal_tutor_turn`). A hyphenated name, or a shell command presented as a tool, is rejected as an invalid tool call.

## Who owns what

| Decision | Owner |
|---|---|
| What the learner is asking, in context | Gemma |
| Which tool to call | Gemma |
| Lesson prose and quiz drafts during course build | Local Gemma, validated by Python |
| Lesson order, quiz state, course switch, resume | `tutor.py` session files |
| Closed-question grade (MCQ, true/false, fill, one-word) | `grade.py` |
| Short-answer score against the stored rubric | Python rubric/key-term overlap, then the CLI commits the rating |
| Next due time | Py-FSRS only |
| Text sent to the chat | JSON `telegram` field, then Hermes |

Do not add a phrase list that routes “start fractions” or similar. The model interprets the words. Python accepts a structured action and checks it against the catalog and session. A pending quiz is context, not an order to treat every new message as an answer.

## Capabilities

- Create a course from a topic, a readable URL, a Telegram PDF attachment, or files dropped in the inbox (`import tutor-inbox`).
- Chunk source text, draft an outline, write short lessons (about 80–280 words) and aligned quiz items, validate them, and create one FSRS card per item.
- Study flow: show one lesson and wait; quiz only when the learner asks; one question; Correct / Not yet plus explanation and a relative due time; optional again/hard/good/easy changes that card only; next item or next lesson.
- Review due course cards only. Progress report: totals, accuracy, weak tags, forecast, streak.
- Several ready courses. Naming one switches to it. Each course keeps its own pending lesson or quiz. After a finished lesson quiz, the next start opens the next unseen lesson.
- Delete one exact course by moving files to `data/trash/`. Review history and the event journal stay. There is no agent restore tool; recovery is manual.
- Standalone cards: add, list without answers, next due card, hint, reveal after an attempt, rate, reset the card store only when the learner explicitly asks.
- Read-only snapshot for planning and lesson-grounded questions. It omits answer keys and the learner’s answer text.
- Daily 08:30 reminder cron: run status, message Telegram only when something is due.
- Learner event journal for messages, course changes, lesson and quiz milestones, reviews, and card actions.
- `/new` clears the chat transcript only. Courses, FSRS cards, and pending units remain.

Guidance skills (no extra tools, no routers): `course-grounded-qa`, `misconception-repair`, `flexible-study-planning`.

## Model-callable tools (`study_coach`)

| Tool | Does |
|---|---|
| `personal_tutor_turn` | Lesson, quiz, answer, rating, review, progress, pause, skip, continue. Pass answers verbatim or a short command that matches the request. |
| `personal_tutor_create_course` | Ingest and build from a topic, URL, or PDF. One call. Do not ask the learner to approve an outline. |
| `personal_tutor_delete_course` | Trash one course after its id and title are unambiguous. |
| `personal_tutor_get_study_snapshot` | Read state. Does not start, grade, rate, or switch. |
| `study_add_card` | One basic front/back card from facts the learner supplied. |
| `study_list_cards` | List topic, state, due time. Hide answers by default. |
| `study_next_card` | Next due card, question only. |
| `study_get_hint` | Stored hint that does not reveal the answer. |
| `study_reveal_card` | Answer after an attempt or an explicit reveal. |
| `study_review_card` | Record again/hard/good/easy and schedule with FSRS. |
| `study_reset` | Delete standalone cards after an explicit request. |

`/personal-tutor` is an optional slash alias for a tutor turn. Course quizzes and standalone cards stay separate stores.

CLI commands the plugin wraps (always `--json`, one JSON object on stdout): `turn`, `ingest`, `build`, `import-inbox`, `delete-course`, `status`, `progress`, `reminders`. Direct study subcommands such as `start` and `quiz` exist for the CLI; the model should not call them itself. Course creation stays inside `personal_tutor_create_course` (ingest, then build). Do not pass `--auto-local`.

## Workflows

**Create.** Learner: “Teach me X”, a URL, a PDF, or “import tutor-inbox”. Tool ingests source to `raw/<course_id>/source.md` and chunks, then `build` writes the outline, lessons, and items, creates FSRS cards, and sets `status=ready`. Chat gets only the final summary and “Reply start”. If the URL is paywalled, script-only, or too thin, or the PDF is scanned, stop with that error. Do not fill the gap with web search.

**Study.** `start <course name>` → one lesson, footer tells them to reply when they want a quiz → one question → grade → relative due → optional rating override of that card → `next`. `review` is due cards only. `progress` is the report.

**Switch / resume.** Each course’s pending unit lives in `state/course-sessions.json`. Naming the course again restores that unit. `continue` resumes the selected course. Ambiguous names list titles. Unknown names list ready courses. A negated name (“not combinatorics”) must not select that course.

**Cards.** Add → later, next due card shows the question → learner answers → reveal → model compares and explains → `study_review_card` writes the FSRS due time. Do not show the answer on the front. Do not schedule on reveal alone.

**Reminder.** One Hermes cron, created once from the `reminders` payload, at 08:30 local. Silent when `due_count` is 0.

## Data

Under the skill `data/` directory (or `TUTOR_ROOT`):

```text
inbox/  raw/<course_id>/  courses/<course_id>/{course.json,items.jsonl}
reviews/review_logs.jsonl
state/user.json  session.json  course-sessions.json  course-progress.json
state/ingested.json  learner-events.sqlite3
trash/<deletion_id>/
```

`user.json` holds timezone, daily new/review limits, `desired_retention` 0.9, session length, active course, streak. `course.json` status is `draft`, `ready`, or `archived`. Items are MCQ (4 options), fill-blank, one-word, true/false, short-answer (3 rubric bullets), or flashcard. Each item’s `fsrs_card` is `Card.to_json()` / `Card.from_json()`. Standalone cards and the event journal share `state/learner-events.sqlite3` (`HERMES_STUDY_DB` overrides the file). Lesson ids collide across courses; always look up lessons and items inside the session’s `course_id`.

## Setup (recreate on a new machine)

1. Install Hermes Agent, Ollama, and a Gemma 4 tag. Point Hermes at `http://127.0.0.1:11434/v1`. Confirm `curl http://127.0.0.1:11434/v1/models`.
2. Create a Telegram bot in BotFather. Run `hermes gateway setup`. Enter the token only in that prompt. Allowlist your numeric user id. Use polling, not a webhook.
3. Copy this skill to `~/.hermes/skills/learning/personal-tutor/` and this plugin to `~/.hermes/plugins/study-coach/`. From the repo, `scripts/deploy-runtime.sh` does that copy and leaves existing data and the venv in place.
4. Run the skill `setup.sh` once. It creates `.venv`, installs `requirements.txt`, makes data directories, and symlinks `personal-tutor` onto `PATH`.
5. Enable the `study_coach` toolset for Telegram. Restart with `hermes gateway restart` (or the launchd label `ai.hermes.gateway` if that is what supervises it). Check `hermes tools list --platform telegram` and `hermes gateway status`.
6. Prove the loop: `personal-tutor status --json`, then in Telegram `/new` and “teach me …” or “start <ready course>”. The reply must be the `telegram` field of a successful tool result, not a claim that the tool is missing.
7. Optional: one cron from `personal-tutor reminders --json` at 08:30 local.

Gateway code changes need a process restart. Skill script changes need a deploy into `~/.hermes` and usually a restart. Repo files alone do not affect the running bot.

## Rules for the implementing model

- Call `personal_tutor_*` or `study_*`. Never call a tool named `personal-tutor`.
- Send the tool’s `telegram` string. Do not paste course JSON, chunks, outlines, or answer keys.
- Do not choose the next study step from hints. The CLI session does.
- A correct closed answer is stored as Good unless the learner then sends again, hard, good, or easy.
- Rating names reschedule the current card. They do not open the next lesson.
- `internal: true` means keep building. The first user-visible creation message is the ready summary.
- Keep one learner action per chat turn.
- Ground lessons and answers in the ingested source. If extraction fails, say so.

## Limits

One learner. No accounts, no second messenger in this prototype. Trash has no restore tool. Image-only PDFs fail extraction. Topic mastery on a progress screen is a summary of recent results and due counts, not a second scheduler. Long-term retention has not been measured.

## References in this repo

- Current Telegram behavior: `docs/study-tool-telegram-milestone.md`
- Skill contract: `.hermes/skills/learning/personal-tutor/SKILL.md`
- Flows: `.hermes/skills/learning/personal-tutor/references/ux-flows.md`
- Schema: `.hermes/skills/learning/personal-tutor/references/schema.md`
- Gateway install notes: `docs/hermes-telegram-setup-runbook.md`
