# Care-Bridge runbook

How to run the demo on the demo Mac. Everything uses the fictional data in `demo/`.

## What's built

| Part | Path | State |
|---|---|---|
| API (FastAPI, SQLite, Py-FSRS) | `services/api/` | Working; 9 tests pass |
| Caregiver Mini App (React) | `apps/miniapp/` | Brief, Handbook (add, PDF upload, approve, edit), Coverage, Changes, Ruth and circle, demo controls |
| Ruth's explainer player (Three.js) | `apps/explainer/` | `weigh_in` and `stand_safely` templates |
| Hermes plugin | `hermes/plugins/care-bridge/` | Tested against the API; **not deployed yet** |
| Seed data and discharge PDF | `demo/` | 15 facts with review history; PDF from 2 Oct 2026 |

Gemma e4b drafts facts from the PDF in about 25–35 seconds; the result is cached by file hash, so a second upload of the same PDF is instant. Laya grading and fact picking fall back cleanly when Laya isn't running.

## Start it

```bash
./scripts/start.sh
```

Open `http://localhost:8000` in a browser. Outside Telegram, a "View as" menu switches between Priya, Marcus and Dev (development only). Ruth's guides are at `http://localhost:8000/explain/?id=exp_weight_rule_v1` and `?id=exp_walker_brakes_v1`.

Run the tests:

```bash
cd services/api && .venv/bin/python -m pytest -q
```

## Steps only you can do

### 1. Revoke the exposed token

The token for @neo_fsrs_coach_bot was printed in a Claude session. In BotFather, send `/revoke` for that bot and put the new token in `~/.hermes/.env` if you still use it.

### 2. ngrok

1. Sign in at ngrok.com and claim your free static domain.
2. Add your authtoken (keep it out of the repo): `ngrok config add-authtoken <token>`
3. Start the tunnel to the API: `ngrok http --url=<your-domain> 8000`
4. Add these lines to `local.env` (git-ignored), then restart `./scripts/start.sh`:

   ```text
   CAREBRIDGE_PUBLIC_URL=https://<your-domain>
   CAREBRIDGE_DEV_AUTH=0
   ```

5. On each demo phone, open the URL once and tap **Visit Site** on ngrok's warning page.

### 3. BotFather for @geeko_fsrs_bot

1. **Bot Settings → Configure Mini App → Enable Mini App**, URL `https://<your-domain>/`. This makes `https://t.me/geeko_fsrs_bot?startapp=...` links open the Mini App.
2. **Bot Settings → Menu Button**, URL `https://<your-domain>/`, title `Care-Bridge`.
3. Optional: `/setname` Care-Bridge and `/setuserpic` with `assets/geeko-pfp.png`.

### 4. Connect people

`CAREBRIDGE_TELEGRAM_IDS` in `local.env` maps each seeded person to a teammate's Telegram account, and the same IDs go in `TELEGRAM_ALLOWED_USERS` in `~/.hermes/.env`. Both are already set for the team: Abhishree is Priya, Nehal is Marcus, Kush is Dev and Amey is Ruth. Keep the IDs out of the repo.

To add someone else, use **Ruth → Connect people** in the Mini App as Priya, or add them to both settings and run **Reset demo data**.

### 5. Hermes for Ruth's chat (E7 and E8)

These change your live Hermes setup, so back up `~/.hermes/config.yaml` and `~/.hermes/.env` first.

1. In `~/.hermes/.env`, set `TELEGRAM_BOT_TOKEN` to the @geeko_fsrs_bot token from `local.env`. Hermes currently polls @neo_fsrs_coach_bot.
2. Add Ruth's and the caregivers' Telegram IDs (from step 4) to `TELEGRAM_ALLOWED_USERS`.
3. Switch the model to e4b and unload 12b:

   ```bash
   hermes config set providers.ollama-launch.default_model gemma4:e4b-mlx
   ollama stop gemma4:12b-mlx
   ```

4. Deploy the plugin: `./hermes/deploy.sh`
5. In `~/.hermes/config.yaml`, under `plugins:`, move `study-coach` from `enabled` to `disabled` and add `care-bridge` to `enabled`.
6. Restart and check:

   ```bash
   hermes gateway restart
   hermes tools list --platform telegram
   ```

   `carebridge_notify_circle` and `carebridge_show_explainer` should be listed. If not: `hermes tools enable care_bridge --platform telegram`.

7. Test from Ruth's phone: "My ankles look puffy today. What was I supposed to do?"

### 6. Laya (Unsloth Decision API)

1. Install Unsloth Studio from [unsloth.ai/download](https://unsloth.ai/download).
2. Settings → API → Decision API: turn on **Serve requests** and **Keyless API access**. Keep the multilingual model on CPU.
3. Test: `curl -s localhost:8888/v1/systemone -H 'Content-Type: application/json' -d '{"model":"laya","state":"test","questions":{"ok":{"type":"noul","instructions":"Is this a test?"}}}'`

No restart is needed; the API calls Laya on each request.

How Care-Bridge uses Laya (multilingual model), based on testing with the demo facts:

- **Grading typed answers:** Laya fast-tracks answers it scores 0.95 or higher as correct. Everything else goes to Gemma, which handles partial and wrong answers. Laya alone marked some wrong answers correct, so it never grades on its own.
- **Ruth's messages:** Laya's fact pick is used when it is at least 90% sure (for example "When do I take my water pill?"). Otherwise Gemma picks, told about Ruth's conditions; keywords are the last fallback.
- **Hints:** Laya's "seems unsure" signal, and its intent when no care fact matched, are passed to Gemma only at 70% confidence or more. They are hints, never permission to act.

Studio runs at `http://localhost:8888`. Start it after a reboot with `unsloth studio -p 8888`.

## Demo controls

In the Mini App as Priya, **Ruth → Demo controls**:

- **Send briefs now** messages every connected caregiver with something due, with an "Open brief" button.
- **Reset demo data** restores the seed. Connected Telegram accounts stay connected.

## Known limits

- The coverage colours use fixed thresholds: green at 90% or more, red under 70%.
- Explainer text from Gemma is checked to contain every number in the fact. If it doesn't, the hand-written guide for that template is used.
- Without `CAREBRIDGE_PUBLIC_URL`, Telegram messages are sent without buttons, because Mini App buttons need HTTPS.
