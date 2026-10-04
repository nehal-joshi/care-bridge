import { Chat, Pull, Reveal } from "./Reveal";

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/CareBridgeBot";

function TelegramButton({ dark = false, label = "Open in Telegram" }: { dark?: boolean; label?: string }) {
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2 self-start rounded-full py-1.5 pl-6 pr-1.5 text-lg font-semibold transition-all hover:gap-3.5 ${
        dark ? "bg-ink text-cream" : "bg-cream text-ink"
      }`}
    >
      {label}
      <span className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${dark ? "bg-cream" : "bg-ink"}`}>
        <svg viewBox="0 0 24 24" className={`h-5 w-5 ${dark ? "text-ink" : "text-cream"}`} fill="currentColor" aria-hidden>
          <path d="M21.9 4.3 2.7 11.7c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.6.1.8.7.8.4 0 .6-.2.9-.4l2.3-2.3 4.8 3.5c.9.5 1.5.2 1.7-.8L22.9 5.5c.3-1.3-.5-1.9-1-1.2Zm-3.4 3.6-8.9 8-.4 4-1.6-5.2 10.9-6.8Z" />
        </svg>
      </span>
    </a>
  );
}

const nav = [
  ["The problem", "#problem"],
  ["How it works", "#how"],
  ["Coverage", "#coverage"],
  ["Ruth", "#ruth"],
];

const circle = [
  { name: "Ruth", role: "Ruth Alvarez, 78", note: "Heart failure and early memory loss. Lives alone, with an aide each day.", tone: "bg-amber text-ink" },
  { name: "Priya", role: "Daughter · primary caregiver", note: "Holds the plan. Adds facts, approves every one, sees the full picture.", tone: "bg-cream text-ink" },
  { name: "Marcus", role: "Weekday aide", note: "Gets a 60-second brief before each shift. Needs the warning signs fresh.", tone: "bg-white/5 ring-1 ring-white/10" },
  { name: "Dev", role: "Son · weekends", note: "Steps in on Saturdays. Reliable on warning signs, rusty on the routine.", tone: "bg-white/5 ring-1 ring-white/10" },
];

const steps = [
  { n: "1", t: "Priya adds the discharge papers", d: "Upload a PDF or type a fact. Gemma drafts plain-language facts with their source. Nothing goes live until Priya approves it." },
  { n: "2", t: "Marcus gets a 60-second brief", d: "A Telegram nudge opens up to five question-first cards: what changed, then what he is about to forget. Type an answer and it is graded on the spot." },
  { n: "3", t: "Everyone stays covered", d: "Warning signs are rehearsed most. If only one person reliably knows one, the family sees it before it matters." },
];

const warnings = [
  { q: "Weight up 3 lb overnight?", who: ["ok", "bad", "ok"] },
  { q: "Sulfa allergy", who: ["ok", "ok", "ok"] },
  { q: "Walker brakes before she stands", who: ["ok", "amber", "ok"] },
  { q: "New confusion can mean a UTI", who: ["ok", "ok", "amber"] },
];

const cell = {
  ok: "bg-ok/90 text-ink",
  amber: "bg-amber text-ink",
  bad: "bg-bad text-ink pulse-red",
} as const;
const cellLabel = { ok: "Knows it", amber: "Fading", bad: "Not yet" } as const;

export default function Home() {
  return (
    <main>
      {/* ============ HERO ============ */}
      <section className="h-svh min-h-[640px] w-full p-2 sm:p-3">
        <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[radial-gradient(120%_100%_at_50%_0%,#3a2f22_0%,#1c1712_45%,#101014_100%)] md:rounded-[2rem]">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/hero-poster.jpg"
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="An old man sits on a cliff above the clouds, working on his laptop at golden hour"
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
          <div className="noise pointer-events-none absolute inset-0 opacity-70 mix-blend-overlay" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/5 to-black/75" />

          <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
            <div className="flex items-center gap-4 rounded-b-2xl bg-black px-5 py-2.5 sm:gap-6 md:gap-10 md:rounded-b-3xl md:px-8">
              {nav.map(([l, h]) => (
                <a key={h} href={h} className="text-xs text-cream/80 transition-colors hover:text-cream sm:text-sm">
                  {l}
                </a>
              ))}
            </div>
          </nav>

          <div className="absolute inset-x-0 bottom-0 px-5 pb-4 sm:px-8 md:px-10">
            <div className="grid grid-cols-12 items-end gap-4">
              <div className="col-span-12 lg:col-span-8">
                <Pull
                  as="h1"
                  text="Care Bridge"
                  className="font-display text-[17vw] font-medium leading-[0.9] tracking-[-0.04em] sm:text-[15vw] lg:text-[11vw]"
                />
              </div>
              <div className="col-span-12 flex flex-col gap-5 pb-4 lg:col-span-4 lg:pb-8">
                <Reveal delay={0.5}>
                  <p className="text-base leading-snug text-cream/85 sm:text-lg">
                    What matters about Ruth&rsquo;s care lives in one person&rsquo;s head. Care-Bridge makes sure the right person remembers the right thing when it matters.
                  </p>
                </Reveal>
                <Reveal delay={0.7} className="flex flex-col gap-3">
                  <TelegramButton />
                  <p className="text-sm text-cream/60">No new app. Everything lives in Telegram.</p>
                </Reveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="overflow-hidden border-y border-white/10 py-5" aria-hidden>
        <div className="marquee flex w-max gap-12 whitespace-nowrap font-display text-3xl text-cream/70 sm:text-4xl">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-12">
              {["Weight up 3 lb? Call the nurse", "Sulfa allergy", "Walker brakes on before she stands", "New confusion can mean a UTI", "Evening meds with food"].map((t) => (
                <span key={t} className="flex items-center gap-12">
                  {t}
                  <span className="text-amber">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============ PROBLEM ============ */}
      <section id="problem" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-24 md:px-8">
        <p className="text-sm uppercase tracking-[0.25em] text-amber">The problem</p>
        <Pull
          text="Ruth has heart failure and early memory loss. Three people care for her. The plan is in Priya's head."
          className="font-display mt-5 max-w-4xl text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl"
        />
        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {circle.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.1}>
              <div className={`h-full rounded-2xl p-6 ${c.tone}`}>
                <div className="font-display text-4xl font-medium">{c.name}</div>
                <div className="mt-1 text-sm font-semibold uppercase tracking-wider opacity-70">{c.role}</div>
                <p className="mt-4 text-base leading-relaxed opacity-90">{c.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ HOW ============ */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 md:px-8">
        <p className="text-sm uppercase tracking-[0.25em] text-amber">How it works</p>
        <Pull text="Three minutes, start to finish." className="font-display mt-5 text-4xl font-medium tracking-tight sm:text-6xl" />
        <ol className="mt-12 space-y-4">
          {steps.map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 0.1}>
                <div className="flex items-start gap-5 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 sm:gap-8 sm:p-8">
                  <span className="font-display text-6xl leading-none text-amber sm:text-7xl">{s.n}</span>
                  <div>
                    <h3 className="text-2xl font-semibold">{s.t}</h3>
                    <p className="mt-2 max-w-2xl text-lg leading-relaxed text-cream/70">{s.d}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ============ COVERAGE ============ */}
      <section id="coverage" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 md:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-sm uppercase tracking-[0.25em] text-amber">Coverage</p>
            <Pull text="See who reliably knows what." className="font-display mt-5 text-4xl font-medium tracking-tight sm:text-5xl" />
            <p className="mt-5 text-lg leading-relaxed text-cream/70">
              Each card is scheduled with spaced repetition, so a warning sign is revisited just before it fades. The grid shows it per person. When Marcus is the red cell, the family hears about it before Ruth&rsquo;s next weigh-in.
            </p>
          </div>
          <Reveal className="lg:col-span-7">
            <div className="rounded-3xl bg-ink2 p-4 ring-1 ring-white/10 sm:p-6">
              <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] items-center gap-2 text-xs uppercase tracking-wider text-cream/50 sm:text-sm">
                <span>Warning sign</span>
                <span className="text-center">Priya</span>
                <span className="text-center">Marcus</span>
                <span className="text-center">Dev</span>
              </div>
              <div className="mt-3 space-y-2">
                {warnings.map((w) => (
                  <div key={w.q} className="grid grid-cols-[1.6fr_repeat(3,1fr)] items-center gap-2">
                    <span className="pr-2 text-sm leading-snug sm:text-base">{w.q}</span>
                    {w.who.map((s, i) => (
                      <span key={i} className={`rounded-xl py-3 text-center text-[11px] font-semibold sm:text-sm ${cell[s as keyof typeof cell]}`}>
                        {cellLabel[s as keyof typeof cellLabel]}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-bad/15 p-4 text-sm text-cream ring-1 ring-bad/40 sm:text-base">
                <span aria-hidden>⚠️</span>
                <p>Only Priya and Dev reliably know the weight rule. Marcus covers weekdays.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ RUTH ============ */}
      <section id="ruth" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="text-sm uppercase tracking-[0.25em] text-amber">For Ruth</p>
            <Pull text="A calm companion that answers from her care plan." className="font-display mt-5 text-4xl font-medium tracking-tight sm:text-5xl" />
            <p className="mt-5 text-lg leading-relaxed text-cream/70">
              Ruth chats with the same bot. Short sentences, one thing at a time, never a test. It answers only from facts her family has approved, and it never contacts anyone without her yes.
            </p>
            <ul className="mt-6 space-y-3 text-lg">
              {["A “Show me” button opens a three-step explainer, like her morning weigh-in", "Big type, a fixed camera, no way to get it wrong", "Asks before it tells Priya"].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber" />
                  <span className="text-cream/85">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <Chat className="relative lg:col-span-6">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/15 blur-3xl" />
            <div className="mx-auto max-w-md rounded-[2.2rem] bg-black p-3 ring-1 ring-white/15">
              <div className="rounded-[1.7rem] bg-[#0e1a22] p-4">
                <div className="mb-4 flex items-center gap-3 border-b border-white/10 pb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber font-display text-lg text-ink">C</span>
                  <div>
                    <div className="text-base font-semibold leading-tight">Care-Bridge</div>
                    <div className="text-xs text-cream/50">bot</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 text-[15px] leading-snug">
                  <div className="bubble self-end rounded-2xl rounded-br-md bg-[#2b5278] px-4 py-2.5" style={{ "--d": ".2s" } as React.CSSProperties}>
                    My ankles look puffy today. What was I supposed to do?
                  </div>
                  <div className="bubble max-w-[88%] self-start rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5" style={{ "--d": "1.1s" } as React.CSSProperties}>
                    Your care plan says to check your weight. Did the scale go up more than 3 pounds since yesterday?
                  </div>
                  <div className="bubble self-end rounded-2xl rounded-br-md bg-[#2b5278] px-4 py-2.5" style={{ "--d": "2s" } as React.CSSProperties}>
                    Yes, about 4.
                  </div>
                  <div className="bubble max-w-[88%] self-start rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5" style={{ "--d": "2.9s" } as React.CSSProperties}>
                    Then the plan says to call the heart failure nurse. Want me to show you the weigh-in steps?
                  </div>
                  <div className="bubble self-start" style={{ "--d": "3.8s" } as React.CSSProperties}>
                    <span className="inline-block rounded-xl bg-amber px-5 py-2.5 text-base font-semibold text-ink">Show me</span>
                  </div>
                  <div className="bubble max-w-[88%] self-start rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5" style={{ "--d": "4.7s" } as React.CSSProperties}>
                    Would you like me to let Priya know too?
                  </div>
                  <div className="bubble self-end rounded-2xl rounded-br-md bg-[#2b5278] px-4 py-2.5" style={{ "--d": "5.5s" } as React.CSSProperties}>
                    Yes please.
                  </div>
                </div>
              </div>
            </div>
          </Chat>
        </div>
      </section>

      {/* ============ EXPLAINER ============ */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <p className="text-sm uppercase tracking-[0.25em] text-amber">The &ldquo;Show me&rdquo; explainer</p>
        <Pull text="Three taps. No way to get it wrong." className="font-display mt-5 text-4xl font-medium tracking-tight sm:text-6xl" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["⚖️", "Step on the scale before breakfast.", "Tap the scale"],
            ["🔢", "Compare with yesterday\u2019s number.", "Watch the display"],
            ["📞", "Up more than 3 pounds? Call your heart failure nurse.", "Tap the phone"],
          ].map(([e, t, a], i) => (
            <Reveal key={t} delay={i * 0.12}>
              <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-b from-[#2a2118] to-ink2 p-7 ring-1 ring-white/10">
                <span className="absolute -right-3 -top-6 font-display text-[9rem] leading-none text-white/5">{i + 1}</span>
                <div className="text-5xl">{e}</div>
                <p className="mt-6 text-2xl leading-snug">{t}</p>
                <span className="mt-6 inline-block rounded-full bg-amber px-5 py-2 text-base font-semibold text-ink">{a}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ SAFETY ============ */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["AI suggests, people approve", "Gemma drafts facts and questions. Only the primary caregiver can approve one, and every fact keeps its source."],
            ["Nothing without a yes", "The assistant never messages the circle, approves a fact or judges Ruth’s health on its own."],
            ["Private by design", "Models run on a local machine. Caregiver-only facts are filtered out before Ruth’s assistant sees anything."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.12}>
              <div className="h-full rounded-2xl bg-cream p-7 text-ink">
                <h3 className="font-display text-2xl font-medium">{t}</h3>
                <p className="mt-3 text-lg leading-relaxed">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section id="contact" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-16 md:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-amber p-8 text-center text-ink sm:p-16">
            <div className="noise pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply" />
            <div className="relative mx-auto flex max-w-2xl flex-col items-center">
              <h2 className="font-display text-4xl font-medium tracking-tight sm:text-6xl">Continue in Telegram</h2>
              <p className="mt-4 max-w-xl text-xl">Briefs, reminders and Ruth&rsquo;s companion all arrive as simple chat messages. Nothing to install.</p>
              <div className="mt-8">
                <TelegramButton dark label="Open Care-Bridge" />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 pb-10 pt-4 text-center text-base text-cream/50 md:px-8">
        <p>🌉 Care-Bridge · a shared memory for the care circle</p>
        <p className="text-sm">Hackathon demo. All people and data shown are fictional.</p>
      </footer>
    </main>
  );
}
