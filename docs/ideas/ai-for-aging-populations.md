# AI for aging populations: product ideas from the FSRS coach

**Status:** idea exploration, October 2026
**Builds on:** [FSRS coach bot one-pager](../prototype/fsrs-coach-bot-one-pager.md)
**Prompt:** Y Combinator request for startups, "AI for Aging Populations"

## Summary

The FSRS coach prototype can do three useful things. It can tell when a person is about to forget a specific fact. It can turn a document into questions with checkable answers. It also keeps the language model away from grades and schedules. Much of what goes wrong in aging care comes down to forgetting and handoffs, so those pieces fit this market.

This doc sets out four problems and four product ideas. Ideas 1–3 each solve one problem. Idea 4 combines them into one product built around one older adult's care circle. **Idea 4 is the recommended direction.** It should be built in stages, starting with the caregiver part from Idea 1.

## Market context (from the YC request)

- By 2030, one in five Americans will be over 65.
- The US is projected to have millions of unfilled caregiving jobs within the decade.
- 53 million family members already do caregiving work unpaid.
- Little technology is built for older people. Even Alexa and Google Home frustrate most seniors.
- YC names four kinds of product: voice interfaces that hold real conversations, monitoring for safety and independence, robots that help at home, and software that helps family caregivers coordinate care.

## What the prototype brings

| Asset | In the prototype | Why it matters for aging |
|---|---|---|
| Forgetting model | Py-FSRS schedules each item and predicts when recall will drop | Knows which fact a person is about to forget, so check-ins stay short |
| Grounded content | A topic, URL or PDF becomes lessons and quiz items, checked by Python | A discharge sheet or care plan becomes questions without invented facts |
| Trust split | The model handles the conversation; Python owns grades, due dates and state | Clinical safety: the model can't invent instructions or change a schedule |
| Question first | The answer stays hidden until the learner tries | The same approach as nurse teach-back and spaced retrieval therapy |
| Proactive reminders | Daily cron that stays silent when nothing is due | Reaches people who won't open an app |
| Event journal | Messages, reviews and milestones are logged | A record of what someone knows over time |

**Limit to respect.** FSRS models *recall of facts*, such as "what do you do if your ankles swell?" It does not model *remembering to do something at a set time*, such as taking a pill at 8pm. That is prospective memory: a matter of reminders and habits. None of these ideas pitch FSRS for medication timing.

## Problem statements

### P1. Care knowledge lives in one person's head

- **Who:** family caregivers, paid home care aides, siblings and respite workers.
- **What goes wrong:** the primary caregiver holds most of what matters: medications, allergies, how to help the person stand, what upsets them and what "normal" looks like for them. Each new aide or relative covering a shift starts from zero. Home care aides change jobs often, so this keeps happening.
- **Today's workaround:** a binder, a shared note, a group text or a phone call before the shift. None of these check whether the next person remembers the critical parts.
- **Cost:** missed allergies, wrong medications and avoidable falls. The primary caregiver burns out because they are the only reliable source.

### P2. Older patients forget what they're told when they leave the hospital

- **Who:** older adults sent home after heart failure, COPD, pneumonia or a joint replacement, and the families helping them.
- **What goes wrong:** patients forget much of what clinicians tell them. One widely cited review estimates that 40–80% is forgotten right away (Kessels, 2003). Discharge is the worst time: the patient is tired, unwell and on new medications.
- **Today's workaround:** a printed instruction packet and perhaps one follow-up phone call. Nurse teach-back happens once, before the patient leaves.
- **Cost:** missed warning signs and avoidable readmissions. Medicare fines hospitals with too many 30-day readmissions through the Hospital Readmissions Reduction Program.

### P3. Memory decline gets too little support and is noticed late

- **Who:** older adults with mild cognitive impairment or early dementia, and their families.
- **What goes wrong:** speech therapists use spaced retrieval training to help people with early dementia hold onto specific useful facts, such as a grandchild's name or "count to five before standing." It needs a therapist running sessions, so it stops when the sessions stop. Gradual decline is often noticed only after a crisis.
- **Today's workaround:** occasional therapy, memory books, sticky notes and cognitive screening at annual checkups.
- **Why it matters now:** the new Alzheimer's drugs, lecanemab and donanemab, are approved for early-stage disease. Noticing change early is worth more than it used to be.

### P4. Responsibility for remembering doesn't shift as memory declines

- **Who:** the older adult and everyone caring for them.
- **What goes wrong:** early on, the older adult can remember their own warning signs and routines. As memory declines, someone else has to take over each of those facts. Nobody tracks which facts the older adult still remembers reliably and which the circle must now cover. The handover happens late, unevenly or only after something goes wrong.
- **Today's workaround:** families notice gaps one at a time, usually after a mistake.
- **Note:** this problem only shows up when P1–P3 are seen together. Idea 4 is built around it.

## Idea 1: Shift-ready care handbook

**Solves:** P1
**One line:** a care handbook about one specific person. Each caregiver gets a briefing before their shift, and FSRS tracks what each of them remembers.

**How it works**

- The primary caregiver sends voice notes, photos of the medication list, the agency care plan and discharge papers. The existing ingest and build steps turn these into a course about the person, plus cards.
- Everyone in the care circle studies the same items, each on their own FSRS schedule.
- Before a shift, each caregiver gets a brief of about 60 seconds. It covers the items they are about to forget and anything that changed since their last shift.
- General guidance from trusted sources comes in through the URL and PDF ingest. Examples: talking with someone who has dementia, what to do after a fall, signs of UTI-related confusion.

> **Bot:** Shift with Ruth in an hour. One quick one: she's refusing evening meds. What works?
> **Aide:** Offer them with applesauce?
> **Bot:** Close. Use pudding, after the 7pm news, not before. (Priya updated this on Tuesday.)

**Reused:** ingest and build, learner-written cards, FSRS, the reminder cron, and the event journal as a shift log.
**New:** care circles with several users and roles, separate FSRS progress per person on a shared deck, a "what changed" feed, and SMS or WhatsApp.
**Who pays:**
- **Home care agencies.** It cuts onboarding work and incidents. Medicare-certified home health agencies must also give aides 12 hours of training a year under 42 CFR 484.80.
- **Dementia care programs in CMS's GUIDE model.** These programs are paid to train and support family caregivers.
- **Families**, second.

**Risks:** families rarely pay for caregiver apps. Sell to agencies and GUIDE programs, and use families to spread the word. The brief must save time, not add homework.

## Idea 2: Teach-back at home

**Solves:** P2
**One line:** a 2-minute daily phone call for 30 days after discharge. It checks that the older adult remembers the few instructions that keep them out of the hospital.

**How it works**

- The existing ingest step turns the discharge instructions PDF into 6–10 items: warning signs, medication changes, diet limits and the follow-up appointment.
- A short daily phone call asks one to three questions, and it works on a landline. The prototype already asks before showing the answer, which is how nurse teach-back works.
- FSRS keeps calls short. Items the patient knows stop coming up, and forgotten ones come back sooner.
- Important items get a higher target. Warning signs could aim for 97% recall and diet tips for 85%. Py-fsrs can run a separate scheduler for each group.
- If the patient misses the same warning sign twice, their caregiver or care manager is alerted with the exact gap: "Ruth doesn't remember to call if she gains 3 lb overnight."
- The bot only repeats what is in the discharge document. For anything else, it tells the patient to call the nurse line.

**Reused:** PDF ingest, lesson and quiz generation, rubric grading (now for spoken answers), FSRS, the cron and the journal.
**New:** phone calls with speech tuned for hearing loss and slower speech, alert rules, a dashboard for care managers, and HIPAA-ready hosting under a business associate agreement (BAA).
**Who pays:** home health agencies, heart failure clinics, Medicare Advantage plans and ACOs, priced per discharge. Results show within 30 days, so pilots are quick.
**Risks:** selling to hospitals is slow, so start with home health agencies or clinics. Over 30 days FSRS mostly runs on default settings, because there isn't enough data to fit the person's own forgetting curve. The gain is shorter calls that adapt, not deep personalization.

## Idea 3: Memory companion

**Solves:** P3
**One line:** a voice companion that holds real conversations and slips in memory practice chosen by family or a therapist. Over months, it notices changes in recall.

**How it works**

- Daily conversations about memories, news and favourite topics, using the prototype's "teach me X" feature. Two or three practice items are woven in.
- It uses errorless learning: hints come early, the bot never says "wrong," and each session ends on a success. It should feel like a chat, not a test.
- Family add cards with photos: "This is Maya, your great-granddaughter, born in June."
- After months of use, recall of familiar items forms a trend. If it drops steadily, the bot gently tells the family it is worth mentioning at the next checkup. It never gives a diagnosis.

**Reused:** course generation from topics, cards, FSRS, event journal.
**New:** a voice channel, errorless-learning rules, photo cards and trend reports.
**Who pays:** families first. Then speech therapy practices (practice between visits), memory clinics and GUIDE programs. Research studies later.
**Risks:**
- **Distress.** Testing someone whose memory is slipping can hurt, so the design must be careful and opt-in.
- **FSRS fit.** Its default settings come from mostly young flashcard users and need testing in this group.
- **Regulation.** Claiming to detect decline requires clinical studies and possibly FDA review as medical software. Start with engagement claims and collect data with a research partner.

## Idea 4: Lernok Circle, one shared memory for a care circle

**Solves:** P1–P4
**Working name:** Lernok Circle
**One line:** one set of facts about one older adult, taught to everyone who needs them. The older adult learns by phone and caregivers by chat. FSRS tracks each person's recall, so the circle takes over critical facts as the older adult's memory declines.

### The core idea: one fact, many learners

Take one fact:

> If Ruth gains more than 3 lb overnight, call the heart failure nurse.
> **Source:** discharge instructions, 28 Sep 2026 · **Tier:** warning sign · **Audience:** Ruth, Priya (daughter), Marcus (weekday aide), Dev (son, weekends)

Each of the four has their own FSRS card for this fact. Ruth practises it on her phone calls. Priya, Marcus and Dev see it in their briefs when they are about to forget it. The fact is stored once, and four people's recall of it is tracked.

### The three ideas become three modes

| Mode | From | Learner | Channel | Runs |
|---|---|---|---|---|
| Shift mode | Idea 1 | Caregivers | SMS, WhatsApp or Telegram | Before each shift |
| Episode mode | Idea 2 | Older adult and circle | Phone call and chat | 30 days after a discharge |
| Companion mode | Idea 3 | Older adult | Phone or voice device | Daily, ongoing, opt-in |

### What the combination does that the three can't do alone

1. **Responsibility moves as memory declines.** Say Ruth's recall of a warning sign drops. Python raises the target recall for that fact on her caregivers' cards and puts it in their next briefs: "Ruth no longer reliably remembers the weight rule. Check her scale on your shift." The safety net moves from Ruth to the circle one fact at a time. This answers P4.
2. **One update reaches everyone.** A medication change on a new discharge sheet updates the fact once. Every learner's card is marked as changed and taught again: Ruth on her next call, the aides in their next brief.
3. **Episodes leave something behind.** When a 30-day discharge program ends, the facts and the circle stay. They become the ongoing care handbook.
4. **One record everyone shares.** The event journal becomes a shared timeline of what was taught, who knows what, what changed and how Ruth's recall is trending. It helps at a doctor's visit or the next hospital admission.
5. **Growth is built in.** An agency or clinic signs up one older adult, and each sign-up brings in three to six family members and aides. Families who join for a discharge stay for long-term care.

### An example week

| When | What happens |
|---|---|
| Sunday | Ruth comes home after a heart failure admission. The home health nurse uploads the discharge PDF, and episode mode creates eight facts. |
| Monday 9:00 | Ruth's 2-minute call asks two questions. Priya gets a short summary for the circle. |
| Tuesday | Priya sends a voice note: "She'll only take her evening pills with pudding." It becomes a new fact for caregivers only. |
| Wednesday 7:30 | Marcus's shift brief covers three items, including two that are new to him: the pudding tip and the weight rule. |
| Friday | Ruth misses the weight rule for the second time. Priya and the care manager get an alert, and the rule's target recall goes up for every caregiver. |
| Day 30 | The episode ends and its facts join the ongoing handbook. If Ruth and her family opt in, she moves to companion mode. |

### Changes from the prototype

| Prototype | Lernok Circle |
|---|---|
| One learner | Many learners per older adult, each with a role |
| Course quizzes and cards in separate stores | One fact store per older adult; each fact has a source, tier and audience |
| FSRS progress per item | FSRS progress per learner per fact |
| One scheduler at 0.9 retention | A scheduler per tier (for example 0.97 for warning signs, 0.9 for routine, 0.85 for nice-to-know), raised for a learner when responsibility shifts |
| Telegram | Phone calls for the older adult, SMS or WhatsApp for caregivers, a web dashboard for care managers |
| One 08:30 cron | Each learner's own schedule for calls, shift briefs and alerts |
| Local Gemma on one machine | HIPAA-ready hosting under a BAA; a local model stays an option for a consumer tier |
| None | Alert rules written in Python, not decided by the model |
| None | Consent and access controls for who sees whose recall data |

The prototype's rules carry over unchanged:
- The model interprets and talks.
- Python owns facts, grades, schedules and alerts.
- Every fact traces to a document or a named person.
- The bot never gives new medical advice.

### Who pays

- **Home care agencies:** per client per month, for onboarding, required training and fewer incidents.
- **CMS GUIDE dementia programs:** for the caregiver training and support they are paid to provide.
- **Home health agencies, heart failure clinics and Medicare Advantage plans:** for episode mode, per discharge.
- **Families:** free when invited to a circle, with a paid tier for companion mode later.

### Rollout

| Phase | Build | Prove |
|---|---|---|
| 1 (weeks) | Shift mode in chat for two or three real care circles, with a hand-built fact store | Caregivers read the briefs, and fewer handoff mistakes are reported |
| 2 | Fact store, roles and change feed | One or two home care agencies pay |
| 3 | Episode mode with phone calls | A pilot with one home health agency or heart failure clinic that tracks 30-day readmissions and ER visits |
| 4 | Companion mode | A research partner tests the recall trends |

### Risks

- **Scope.** This is three products in one. To manage it, build one engine (a fact store with FSRS per learner) and ship the modes in order.
- **Consent and capacity.** Ruth's recall data is sensitive. She decides who sees it, or her healthcare proxy does if she can no longer decide. By default the circle sees *what to reinforce*, not her scores.
- **Dignity.** Ruth must never feel her family is testing her.
- **Regulation.** HIPAA applies once the product works with clinics or health plans. Make no claims about detecting decline without clinical validation, which may bring FDA review.
- **FSRS fit.** The default settings come from mostly young flashcard users. Test them with older adults and people with memory decline.
- **Caregiver burden.** The product must remove work. Briefs stay under 60 seconds.

## Comparison

| | 1. Shift-ready | 2. Teach-back | 3. Memory companion | 4. Lernok Circle |
|---|---|---|---|---|
| Problem | P1 | P2 | P3 | P1–P4 |
| Main learner | Caregivers | Older adult | Older adult | Both |
| Work beyond the prototype | Small | Medium | Large | Large, but in stages |
| Buyer | Agencies, GUIDE programs | Home health, Medicare Advantage | Families, speech therapists | All of these |
| Time to first proof | Weeks | 30 days | Months | Weeks (phase 1) |
| Hard to copy | Care circle habits and data | Outcome data | Years of recall data | All three, linked per person |

## Recommendation

Pursue Idea 4 as the product vision, built in the order of the rollout table and starting with shift mode. Phase 1 needs the least new work because caregivers already use chat. It also matches YC's wording about family caregivers, and it creates the care circles that episode mode and companion mode plug into later.

## Next steps

1. Interview 10–15 family caregivers of people with dementia, 3–5 home care agency owners and 1–2 discharge nurses. Ask about the last time someone covering a shift didn't know something important, and how they found out.
2. Run the current bot for two weeks with two or three real care circles, using a hand-built deck about one person.
3. Check every figure in the table below before using it in a pitch.

## Evidence to check

| Claim | Source | Note |
|---|---|---|
| One in five Americans over 65 by 2030 | YC request (US Census projection) | Taken from the prompt |
| 53 million unpaid family caregivers | YC request (AARP and National Alliance for Caregiving, 2020) | Check whether a newer AARP report gives a higher figure |
| 40–80% of medical information forgotten right away | Kessels, *J R Soc Med*, 2003 | Check the exact wording |
| Aides need 12 hours of in-service training a year | 42 CFR 484.80 | Medicare-certified home health agencies only; rules for private-duty aides vary by state |
| GUIDE pays for caregiver training and support | CMS GUIDE Model, launched July 2024 | Check payment details |
| Spaced retrieval helps people with dementia keep specific facts | Camp and colleagues; Brush and Camp, 1998 | Find a recent review |
| Medicare fines hospitals for excess 30-day readmissions | CMS Hospital Readmissions Reduction Program | Check the current list of conditions |
| Lecanemab and donanemab are for early-stage disease | FDA labels | |
