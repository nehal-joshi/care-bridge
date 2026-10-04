# Care-Bridge: project brief

Ready-to-paste answers for the submission form. Shorten or combine sections to fit the form's limits.

## Project name

Care-Bridge

## Tagline

The right person remembers the right thing when it matters: a shared, spaced-repetition memory for everyone caring for an older adult.

Shorter: A shared memory for everyone caring for an older adult: the right person remembers the right thing when it matters.

## Short description

Care-Bridge is a shared care memory and coordination layer for an older adult's whole care circle, on Telegram. Families and aides keep one approved, continuously updated care plan: medicines, warning signs, routines and contacts. Every change reaches everyone in real time, with a history of who changed what. Spaced-repetition briefs teach each caregiver the facts they're about to forget, and a coverage view shows who would remember each warning sign. A live daily checklist logs medicines, meals and health checks, and a photo of a lab report becomes a health record. The older adult asks questions in their own words and gets answers only from their approved care plan, plus simple 3D guides. When they say "I feel unwell" or "call my daughter", the whole circle is alerted. Caregivers can ask what a condition means for daily care or what to do in an emergency. Gemma 4 and Laya run locally on one computer, so health information stays at home.

## The problem

Millions of families care for an ageing parent, and the work is split across a daughter, a son, paid aides and respite workers. What keeps the older adult safe lives in one exhausted person's head: the new dose after a hospital stay, the allergy, the warning sign that means "call the nurse", the trick that gets her to take her evening pills. Every handoff loses some of it. When an aide forgets a warning sign or a son covering the weekend doesn't know a dose changed, the older adult can end up back in hospital.

Existing tools store information (binders, group chats, care apps) but nothing checks whether the next caregiver actually remembers it, and nothing adapts as the older adult's own memory declines. Meanwhile, the older adult is usually left out entirely, because most technology isn't built for them.

## What it does

Care-Bridge gives one older adult's care circle a shared memory, on Telegram.

**For caregivers (a Telegram Mini App):**
- **Handbook:** care facts about the older adult, each with its source. A caregiver can upload a discharge PDF, and Gemma drafts facts and spots what changed (for example a dose going from 20 mg to 40 mg). The primary caregiver approves every fact before anyone sees it.
- **Briefs:** each caregiver gets a short brief of the facts they're about to forget, scheduled with FSRS spaced repetition. Warning signs get a higher recall target, and changed facts come first. Typed answers are graded by a local decision model (Laya), with Gemma checking anything Laya isn't sure about.
- **Coverage:** for every warning sign, who would actually remember it today, with an alert when only one person does.
- **Today:** the daily checklist of medicines, meals and health checks. Ticking a box shows everyone who did what and when; refusals and skips carry a note.
- **Health records:** a caregiver can photograph a lab report in the chat. Gemma reads it on the device, saves the values exactly as printed, and confirms which results are out of range. It never interprets them.
- **Reports:** weekly or monthly PDF and CSV reports for doctors' appointments, downloadable or sent straight to the chat.

**For the older adult (a familiar Telegram chat):**
- She asks questions in her own words ("My ankles look puffy, what was I supposed to do?") and gets short answers drawn only from her approved care plan.
- When words aren't enough, the bot sends a small interactive 3D guide (for example, how to do her daily weigh-in), with large text and no way to get it wrong.
- When she asks for help, her whole circle is notified immediately; otherwise the bot asks before telling anyone. Caregiver-only notes are never shown to her.

**Memory that shifts with her:** when the older adult stops reliably remembering a warning sign, responsibility for it moves to the circle, and Care-Bridge raises her caregivers' recall target for that fact.

## How we built it

- **Hermes Agent** runs the Telegram bot and conversations. A Care-Bridge plugin injects role-aware context before every reply: the older adult's profile, the circle, the facts that person may see, today's checklist, coverage, briefs, health records and recent changes.
- **Gemma 4 (e4b), running locally on Ollama,** drafts facts from PDFs, reads lab-report photos, picks the relevant care fact for each message, grades answers and writes replies.
- **Laya, a local decision model served by Unsloth,** makes fast typed decisions (grading, picking facts) when it's confident; Gemma handles the rest.
- **Py-FSRS** schedules every caregiver's card for every fact and estimates recall for the coverage view.
- **FastAPI and SQLite** hold the circle, handbook, schedules, logs, records and events. Python, not the model, owns facts, schedules, grades and notifications.
- **React (Telegram Mini App)** for caregivers, and a **Three.js** explainer player for the older adult. The model only fills in a validated step list; it never generates code.
- Everything runs on one 18 GB Mac, exposed to Telegram through ngrok.

## What makes it different

- It measures and maintains what each caregiver actually remembers, instead of just storing information.
- The older adult is a first-class user, through the simplest interface she already has.
- It runs entirely on local models, so a family's health information stays on their own machine.
- The model interprets and talks; deterministic code decides. Nothing reaches the circle without a person approving it, and nothing is sent on the older adult's behalf without her asking.

## Challenges we ran into

- **Memory:** Gemma uses about 17 GB of an 18 GB Mac, so we kept a single model loaded and capped how long the bot waits for it.
- **Laya alone wasn't accurate enough.** In our tests it marked wrong answers as correct and picked the wrong fact for some messages, so we made it a high-confidence fast path backed by Gemma.
- **Hermes stops waiting for a plugin after 30 seconds,** but reading a lab-report photo can take longer, so photos are read in the background and the bot confirms when the record is saved.
- **Privacy between roles:** testing showed the older adult's chat could see a caregiver-only note hidden in a schedule's details. We now filter what she sees in code, before the model sees anything.
- **Consent versus safety:** we tell the circle immediately when the older adult asks for someone or describes an emergency, and ask her first otherwise.

## Accomplishments we're proud of

- A working end-to-end product, with four of us roleplaying a real care circle on our own phones.
- From a photo of a fictional blood test, Gemma caught every out-of-range result with exact values and ranges, running locally.
- From a fictional discharge PDF, Gemma recognised the dose change as an update to an existing fact rather than a new one.
- The bot told the whole circle the moment "Ruth" asked for help, without relying on the model to remember to.

## What we learned

- Small local models are good enough for real care workflows when they fill in structured, validated outputs, rather than acting freely.
- Spaced repetition, built for students, fits caregiving well: the cost of forgetting is a missed warning sign, not a missed exam question.
- Designing for an older adult means fewer choices, one step at a time, and never telling her she's wrong.

## What's next

- Phone calls for older adults who don't use Telegram, using the same care plan and guides.
- A pilot with a home-care agency and families of people with early dementia.
- Measuring whether briefs actually reduce missed warning signs, and tuning FSRS for caregivers and older adults.
- WhatsApp and SMS for caregivers, more languages, and privacy-compliant hosting for agencies.

## Built with

Gemma 4 (e4b) · Ollama · Laya (Unsloth Decision API) · Hermes Agent · Py-FSRS · FastAPI · SQLite · React · TypeScript · Vite · Three.js · Telegram Bot API and Mini Apps · ngrok · Python

## Team

- Nehal Joshi: backend, models and Hermes
- Abhishree: product and testing (Priya)
- Kush Anchalia: prototype and testing (Dev)
- Amey ([perfect7613](https://github.com/perfect7613)): landing page and testing (Ruth)

## Links

- Code: https://github.com/nehal-joshi/care-bridge
- Demo: add the video link

All people, health details and documents in the demo are fictional.
