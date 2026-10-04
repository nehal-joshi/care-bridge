# Care-Bridge demo script

About 4 minutes, on four phones plus a projected screen. Everything shown is fictional data running on one Mac.

| Person | Plays | Phone shows |
|---|---|---|
| Abhishree | Priya, Ruth's daughter and primary caregiver | Mini App + bot chat |
| Nehal | Marcus, weekday aide | Mini App + bot chat |
| Kush | Dev, Ruth's son | Bot chat |
| Amey | Ruth, 78, heart failure and early memory loss | Bot chat |

The narrator can be anyone; mirror Abhishree's phone to the screen.

## 15 minutes before

1. Check every service is running on the demo Mac:
   - ngrok tunnel to port 8000
   - Care-Bridge API: `curl -s localhost:8000/api/health` shows `"ollama": true`
   - Unsloth Studio with the Decision API at `localhost:8888`
   - Hermes gateway: `hermes gateway status`
2. Abhishree: **Ruth → Demo controls → Reset demo data.** This restores the seed and clears earlier test records and logs; everyone stays connected.
3. Warm up Gemma: anyone sends the bot "hi" and waits for the reply (the first reply after a pause can take 30 seconds).
4. Abhishree uploads `demo/ruth-discharge-2026-10-02.pdf` once and **discards** the drafts. The result is cached, so the on-stage upload is instant.
5. Every phone: open the bot, tap **Care-Bridge**, and get past ngrok's "Visit Site" page.
6. Close other apps on the Mac. Gemma uses most of its memory.
7. Have `demo/ruth-alvarez-cbc-2026-10-06.png` saved on Abhishree's phone.

## The script

### 1. The problem (20 s, narrator)

"Ruth is 78. She has heart failure and early memory loss, and she lives alone. Three people look after her: her daughter Priya, an aide called Marcus, and her son Dev at weekends. Everything that keeps Ruth safe lives in Priya's head. When Marcus forgets a warning sign, or Dev doesn't know the dose changed, Ruth ends up back in hospital. Care-Bridge makes sure the right person remembers the right thing when it matters."

### 2. A lab report, straight from the chat (start it first, 15 s)

- **Abhishree** sends the CBC photo to the bot: "Ruth's blood test from this morning."
- **Narrator:** "Priya just photographed Ruth's blood test. Gemma is reading it locally on this laptop while we carry on."

It takes up to a minute; come back to it in step 5.

### 3. Today's checklist (40 s)

- **Abhishree** (Today tab): "This is Ruth's day: medicines, meals, health checks. Priya can see what's done and by whom."
- **Abhishree** taps **+ Add to schedule**: Health check, 18:00, "Blood pressure check", "Write it on the fridge sheet". Add.
- **Nehal** (Today tab) ticks **Blood pressure check**.
- **Abhishree** taps another tab and back to refresh: "Done by Marcus at …". No group texts and no "did anyone give her the pill?"
- **Nehal** taps **More** on Metoprolol → **Refused**, note "Said her tummy hurt". It turns red and appears in Changes.

### 4. The discharge PDF (35 s)

- **Abhishree:** Handbook → **+ Add** → upload `ruth-discharge-2026-10-02.pdf`.
- "Gemma reads the hospital's instructions and compares them with Ruth's handbook. It spotted that her water pill went from 20 mg to 40 mg, drafted the new instructions, and skipped the ones she already has." (Read the actual counts from the screen.)
- Approve the **water pill update**. "Nothing reaches the circle until Priya approves it."

### 5. The lab report is saved (20 s)

- Abhishree's chat now shows the bot's confirmation: low red cells, haemoglobin 10.8, low haematocrit, high RDW.
- **Abhishree** opens **Ruth → Health records**. "Copied exactly from the photo. Care-Bridge never interprets results; it tells you to ask her doctor."

### 6. Marcus's brief (45 s)

- **Abhishree:** Ruth → **Send briefs now.** Nehal's and Kush's phones buzz.
- **Nehal** taps **Open brief**. The first card is the water pill, marked **Changed**, with 20 mg crossed out. "Marcus learns about the new dose before his next shift."
- Next card: a warning sign. **Nehal** types an answer in his own words, e.g. "phone her nurse", and taps **Check my answer**. "Laya, a small local decision model, fast-tracks answers it's sure about; Gemma checks the rest."
- "FSRS, the spaced-repetition scheduler, decides when Marcus sees each fact again, just before he's likely to forget it."

### 7. Coverage (20 s)

- **Abhishree:** Coverage tab. "For every warning sign: who would actually remember it today. Marcus is red on the urinary-infection sign, so Care-Bridge raises the alert."
- Point at the weight rule: "Ruth stopped reliably remembering this one, so responsibility shifted to the circle. Care-Bridge now aims for 99% recall among her caregivers."

### 8. Ruth (60 s)

- **Amey** (as Ruth): "My ankles look puffy today. What was I supposed to do?"
- The bot answers from her approved care plan: weigh herself, call the heart-failure nurse if she's up more than 3 lb, with the number. It offers to show her.
- A **Show me** button arrives in her chat (the backend sends it with the answer). **Amey** taps it; the 3D guide walks her through the weigh-in, one large step at a time. If it doesn't arrive, Amey says "Yes, show me."
- **Amey:** "I'm not feeling well. Please tell Priya."
- All three caregiver phones buzz: "Ruth asked for help…". **Abhishree** shows Changes: "Ruth in chat · Asked for someone · Feeling unwell."
- **Narrator:** "Ruth asked, so that's her consent. If she hadn't asked, the bot would have asked her first. And Ruth never sees caregiver-only notes, like the pudding trick for her evening pills."

### 9. Dev catches up (20 s)

- **Kush** (as Dev) asks the bot: "I'm covering this weekend. Anything I should know about Mom?"
- Expect: the water pill change, the refused evening pill, the blood test results to raise with Dr. Okafor, and that Ruth asked for help today.

### 10. Priya's report (15 s)

- **Abhishree:** Today → **Reports** → Last 7 days → **Send to my chat**. The PDF arrives in her chat: completion per item, missed and refused items, notes, weights and who logged what. "Ready for the next doctor's appointment."

### 11. Close (15 s, narrator)

"Care-Bridge runs on one laptop: Gemma and Laya locally, so Ruth's information never leaves the house. Spaced repetition makes sure her caregivers remember what matters, and a familiar Telegram chat lets Ruth ask for help in her own words. Care-Bridge doesn't just store care information; it makes sure the right person remembers it when it matters."

## If something goes wrong

| Problem | What to do |
|---|---|
| The lab-report confirmation hasn't arrived by step 5 | Carry on and show it at the end; Gemma may be busy with another reply |
| A reply takes more than 30 seconds | Narrate over it; Gemma is reloading. Avoid sending messages from two phones at once |
| The "Show me" button doesn't come | Amey says "show me how to weigh myself", or Abhishree taps **Ruth → Ruth's guides → Send to Ruth** |
| The Mini App shows an error | Close and reopen it from the Care-Bridge button |
| The PDF upload is slow | It wasn't cached: talk through the drafts while it finishes (about 30 seconds) |
| Anything else | Play the backup screen recording |
