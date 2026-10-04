import Image from "next/image";
import { BellRing, CalendarClock, EyeOff, Network, Shuffle, UserRound, Lock, UserCheck, MessageSquareText, Server } from "lucide-react";
import { Reveal } from "./Reveal";
import { Logo } from "@/components/site/logo";
import { TelegramLink } from "@/components/site/telegram";
import { Showcase } from "@/components/site/showcase";
import { Faq } from "@/components/site/faq";
import { Separator } from "@/components/ui/separator";

const nav = [
  ["The problem", "#problem"],
  ["How it works", "#how"],
  ["Principles", "#principles"],
  ["FAQ", "#faq"],
];

const problems = [
  {
    icon: UserRound,
    t: "The plan lives in one head",
    d: "Medicines, allergies, routines and warning signs are known by whoever has done the job longest, usually a single family member. Nothing is written down in a form the next person can use at a glance.",
  },
  {
    icon: Shuffle,
    t: "Every handoff loses something",
    d: "Aides rotate, relatives cover weekends, shifts overlap. Each handoff is a hurried conversation, and the detail that matters most is the one most likely to be left out.",
  },
  {
    icon: EyeOff,
    t: "Nobody can see who knows what",
    d: "A caregiver might have been told about the allergy once, months ago. There is no way to tell whether they still remember it, so the gap stays hidden until something goes wrong.",
  },
  {
    icon: CalendarClock,
    t: "Plans change faster than people hear",
    d: "A dose is adjusted, a new symptom to watch for is added. The update reaches some caregivers and not others, so the circle is quietly working from different versions of the truth.",
  },
  {
    icon: Network,
    t: "The older adult is left out of their own plan",
    d: "The person being cared for often cannot recall their own instructions, and the plan is written for caregivers, not for them. They have nobody to ask in the moment they need an answer.",
  },
];

const timeline = [
  ["Monday", "A new rule is added to the plan: if weight jumps overnight, call the nurse."],
  ["Wednesday", "A different aide covers the shift. The rule was never passed on."],
  ["Thursday", "Swelling appears. The scale shows a jump. No one on shift knows it matters."],
  ["Friday", "The family finds out after the fact. The information existed, but it was in the wrong place."],
];

const principles = [
  { icon: UserCheck, t: "AI suggests, people approve", d: "Models draft facts and questions. A person says yes before anything is saved or sent." },
  { icon: Lock, t: "Nothing without a yes", d: "The assistant never contacts the circle, approves a fact or concludes anything about health on its own." },
  { icon: MessageSquareText, t: "Plain words, one thing at a time", d: "Short sentences, no tests, no wrong answers. Built for people who are tired, busy or new." },
  { icon: Server, t: "Runs on a local machine", d: "Models run locally, and caregiver-only facts are filtered before the companion sees anything." },
];

export default function Home() {
  return (
    <main className="overflow-x-clip">
      {/* ============ NAV ============ */}
      <header className="sticky top-0 z-40 px-3 pt-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full bg-paper/85 px-4 py-2.5 shadow-sm ring-1 ring-border backdrop-blur-md sm:px-6">
          <a href="#top" aria-label="Care-Bridge home"><Logo /></a>
          <nav className="hidden items-center gap-8 text-[15px] font-medium md:flex">
            {nav.map(([l, h]) => (
              <a key={h} href={h} className="text-muted-foreground transition-colors hover:text-foreground">{l}</a>
            ))}
          </nav>
          <TelegramLink label="Open Telegram" className="h-10 px-5 text-sm" />
        </div>
      </header>

      {/* ============ INTRO ============ */}
      <section id="top" className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-16 md:px-8 lg:grid-cols-12 lg:pt-24">
        <div className="lg:col-span-7">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky px-4 py-1.5 text-sm font-semibold text-teal">
              <span className="size-2 rounded-full bg-coral" /> A shared memory for the care circle
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="font-display mt-6 text-[2.9rem] font-medium leading-[0.98] sm:text-7xl lg:text-[5.4rem]">
              The right person remembers the right thing, <span className="italic text-coral">when it matters.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-7 max-w-xl text-xl leading-relaxed text-muted-foreground">
              Care-Bridge gives everyone who looks after an older adult one shared, always-current plan. Short briefs before each shift, a clear view of who knows what, and a calm companion for the person at the centre.
            </p>
          </Reveal>
          <Reveal delay={0.24} className="mt-9 flex flex-wrap items-center gap-4">
            <TelegramLink variant="coral" />
            <a href="#problem" className="text-base font-semibold underline decoration-2 underline-offset-8 hover:text-coral">See the problem we solve</a>
          </Reveal>
        </div>

        <Reveal delay={0.2} className="relative lg:col-span-5">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-t-[999px] rounded-b-[2.5rem] bg-teal ring-1 ring-border">
            <Image src="/images/mom-portrait.jpg" alt="A smiling older woman at home" fill priority sizes="(min-width:1024px) 420px, 90vw" className="object-cover object-[56%_15%]" />
          </div>
          <div className="floaty absolute -left-4 bottom-16 w-60 rounded-2xl bg-paper p-4 shadow-[0_20px_40px_-15px_rgba(14,47,46,.4)] ring-1 ring-border sm:-left-10">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal"><BellRing className="size-4" aria-hidden /> Before your shift</div>
            <p className="font-display mt-2 text-lg leading-snug">3 cards, about 60 seconds</p>
            <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 w-2/3 rounded-full bg-teal" /></div>
          </div>
          <div className="floaty absolute -right-2 top-10 w-52 rounded-2xl bg-foreground p-4 text-background shadow-[0_20px_40px_-15px_rgba(14,47,46,.5)] sm:-right-8" style={{ animationDelay: "-3s" }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-sun">Coverage alert</p>
            <p className="mt-2 text-base leading-snug">One warning sign has no backup.</p>
          </div>
        </Reveal>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="overflow-hidden border-y border-border bg-foreground py-5 text-background" aria-hidden>
        <div className="marquee flex w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center gap-10 pr-10 font-display text-2xl sm:text-3xl">
              {["Briefs before every shift", "Warning signs rehearsed most", "Changes reach everyone", "Approved by a person", "Inside Telegram"].map((t) => (
                <span key={t} className="flex items-center gap-10">
                  {t}
                  <span className="size-2.5 rounded-full bg-sun" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ============ PROBLEM ============ */}
      <section id="problem" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-28 md:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">The problem</p>
              <h2 className="font-display mt-4 text-4xl font-medium leading-[1.02] sm:text-6xl">
                Good care depends on information that keeps slipping through the cracks.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Looking after an older adult is rarely a one-person job. Family, paid aides and visiting nurses all share it, and each of them carries a different, partial picture of what matters.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                The result is not carelessness. It is a system with no shared memory, where the cost of a forgotten detail is paid by the person being cared for.
              </p>
            </div>
          </div>
          <ol className="space-y-4 lg:col-span-7">
            {problems.map((p, i) => (
              <li key={p.t}>
                <Reveal delay={i * 0.05}>
                  <div className="flex gap-5 rounded-[1.6rem] bg-paper p-6 ring-1 ring-border sm:p-8">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky text-teal">
                      <p.icon className="size-6" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-display text-2xl font-medium">{p.t}</h3>
                      <p className="mt-2 text-lg leading-relaxed text-muted-foreground">{p.d}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        {/* what goes wrong */}
        <Reveal className="mt-20">
          <div className="grain relative overflow-hidden rounded-[2.2rem] bg-teal p-8 text-background sm:p-12">
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sun">How a missed detail happens</p>
                <h3 className="font-display mt-4 text-3xl font-medium leading-tight sm:text-5xl">The information was there. It just never reached the person who needed it.</h3>
                <div className="relative mt-8 aspect-[16/10] overflow-hidden rounded-2xl">
                  <Image src="/images/mom-phone.jpg" alt="An older woman smiling while looking at her phone on the sofa" fill sizes="(min-width:1024px) 440px, 90vw" className="object-cover" />
                </div>
              </div>
              <ol className="relative space-y-6 lg:col-span-7 lg:pl-6">
                <span className="absolute bottom-3 left-[11px] top-3 w-px bg-background/25 lg:left-[35px]" aria-hidden />
                {timeline.map(([d, t], i) => (
                  <li key={d} className="relative flex gap-5 lg:pl-6">
                    <span className={`relative z-10 mt-1.5 size-6 shrink-0 rounded-full ring-4 ring-teal ${i === 3 ? "bg-coral" : "bg-sun"}`} />
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wider text-sun">{d}</p>
                      <p className="mt-1 text-xl leading-snug">{t}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ HOW ============ */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">How it works</p>
          <h2 className="font-display mt-4 text-4xl font-medium leading-[1.02] sm:text-6xl">One plan, kept current, remembered by everyone.</h2>
        </div>
        <div className="mt-12">
          <Showcase />
        </div>
      </section>

      {/* ============ PRINCIPLES ============ */}
      <section id="principles" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Principles</p>
          <h2 className="font-display mt-4 text-4xl font-medium leading-[1.02] sm:text-6xl">Helpful AI, with people firmly in charge.</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((p, i) => (
            <Reveal key={p.t} delay={i * 0.08}>
              <div className={`h-full rounded-[1.6rem] p-7 ${i === 0 ? "bg-coral text-white" : i === 1 ? "bg-sun" : i === 2 ? "bg-sky" : "bg-paper ring-1 ring-border"}`}>
                <p.icon className="size-8" aria-hidden />
                <h3 className="font-display mt-10 text-2xl font-medium leading-tight">{p.t}</h3>
                <p className={`mt-3 text-base leading-relaxed ${i === 0 ? "text-white/90" : "text-foreground/75"}`}>{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-20 md:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">FAQ</p>
        <h2 className="font-display mb-10 mt-4 text-4xl font-medium leading-[1.02] sm:text-5xl">Questions, answered.</h2>
        <Faq />
      </section>

      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <Reveal>
          <div className="grain relative grid overflow-hidden rounded-[2.2rem] bg-foreground text-background lg:grid-cols-2">
            <div className="p-8 sm:p-14">
              <h2 className="font-display text-4xl font-medium leading-[1.02] sm:text-6xl">Bring the whole circle into one conversation.</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-background/75">No new app to learn. Open Telegram and start with the first fact.</p>
              <div className="mt-8"><TelegramLink variant="coral" label="Open Care-Bridge" /></div>
            </div>
            <div className="relative min-h-72 lg:min-h-full">
              <Image src="/images/mom-portrait.jpg" alt="" fill sizes="(min-width:1024px) 560px, 100vw" className="object-cover object-[50%_25%]" />
              <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/10 to-transparent max-lg:bg-gradient-to-t" />
            </div>
          </div>
        </Reveal>
      </section>

      <Separator className="mx-auto max-w-6xl" />
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row md:px-8">
        <Logo />
        <p>Hackathon demo. All people and data shown are fictional. Photos from Unsplash.</p>
      </footer>
    </main>
  );
}
