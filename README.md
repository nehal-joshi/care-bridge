# Care-Bridge

Care-Bridge keeps everyone caring for an older adult on the same page. Caregivers get short, spaced briefs on the facts they're about to forget, through a Telegram Mini App. The older adult can ask the same bot about their care plan and get small visual guides. All people and health details in this repo are fictional.

## Run it

```bash
./scripts/start.sh
```

Then open `http://localhost:8000`. See the [runbook](docs/hackathon/runbook.md) for ngrok, BotFather, Hermes and Laya setup.

## Layout

```text
services/api/                 FastAPI + SQLite + Py-FSRS; Gemma (Ollama) and Laya clients; Telegram send-only client
apps/miniapp/                 Caregiver Telegram Mini App (React + TypeScript)
apps/explainer/               Ruth's explainer player (Three.js), served at /explain/
web/                          Next.js landing page (Amey)
hermes/plugins/care-bridge/   Hermes plugin: role-aware context and two tools; deploy with hermes/deploy.sh
demo/                         Seed data, fictional discharge PDF and its generator
scripts/start.sh              Builds both web apps and starts the API on port 8000
docs/
  prototype/fsrs-coach-bot-one-pager.md   How the original FSRS coach bot works
  ideas/ai-for-aging-populations.md       Problem statements and four product ideas
  hackathon/feature-list.md               Features and today's hackathon scope
  hackathon/execution-plan.md             Build plan: architecture, API, team split, schedule
  hackathon/runbook.md                    How to run and demo what's built
  hackathon/demo-script.md                The 4-minute demo, step by step
  hackathon/project-brief.md              Answers for the submission form
assets/geeko-pfp.png                      Bot profile picture
local.env                                 Local settings and secrets; git-ignored
```

## Start here

- [Demo script](docs/hackathon/demo-script.md)
- [Project brief](docs/hackathon/project-brief.md)
- [Runbook](docs/hackathon/runbook.md)
- [Hackathon execution plan](docs/hackathon/execution-plan.md)
- [Care-Bridge feature list and hackathon scope](docs/hackathon/feature-list.md)
- [AI for aging populations: product ideas](docs/ideas/ai-for-aging-populations.md)
- [FSRS coach bot one-pager](docs/prototype/fsrs-coach-bot-one-pager.md)
