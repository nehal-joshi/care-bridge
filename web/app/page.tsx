import Image from "next/image";
import { BellRing, CalendarClock, EyeOff, Network, Shuffle, UserRound, Lock, UserCheck, MessageSquareText, Server } from "lucide-react";
import { Reveal } from "./Reveal";
import { Logo } from "@/components/site/logo";
import { TelegramLink } from "@/components/site/telegram";
import { Showcase } from "@/components/site/showcase";
import { Faq } from "@/components/site/faq";
import { Separator } from "@/components/ui/separator";

const nav = [
  ["Problem", "#problem"],
  ["How it works", "#how"],
  ["Principles", "#principles"],
  ["FAQ", "#faq"],
];

const problems = [
  {
    icon: UserRound,
    t: "One person holds the plan",
    d: "Medicines, allergies and warning signs live in the head of whoever has done this longest. Usually that's one family member.",
  },
  {
    icon: Shuffle,
    t: "Handoffs drop details",
    d: "Aides rotate. Relatives cover weekends. Each handoff is a rushed chat, and the most important detail is the easiest to miss.",
  },
  {
    icon: EyeOff,
    t: "No one knows who remembers what",
    d: "The aide heard about the allergy once, months ago. Do they still remember? No one can tell until it matters.",
  },
  {
    icon: CalendarClock,
    t: "Changes don't reach everyone",
    d: "A dose goes from 20 mg to 40 mg. Some caregivers hear about it. Others keep following the old plan.",
  },
  {
    icon: Network,
    t: "The older adult is left out",
    d: "The plan is written for caregivers. The person it's about can't always recall it and has no one to ask when it matters.",
  },
];

const timeline = [
  ["Monday", "A new rule goes into the plan: if her weight jumps overnight, call the nurse."],
  ["Wednesday", "A different aide covers the shift. No one tells them the rule."],
  ["Thursday", "Her ankles swell. The scale jumps. No one on shift knows it matters."],
  ["Friday", "The family finds out too late. The rule existed. The aide on shift just didn't know it."],
];

const principles = [
  { icon: UserCheck, t: "AI drafts, people approve", d: "Nothing reaches the circle until a person approves it." },
  { icon: Lock, t: "Clear limits", d: "The bot never approves a fact or interprets test results. It contacts the circle only when asked, or in an emergency." },
  { icon: MessageSquareText, t: "Plain words", d: "Short sentences, one step at a time. No tests and no wrong answers." },
  { icon: Server, t: "Health data stays home", d: "The AI models run on one computer at home, not in the cloud." },
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
              <span className="size-2 rounded-full bg-coral" /> Shared care memory, in Telegram
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="font-display mt-6 text-[2.9rem] font-medium leading-[0.98] sm:text-7xl lg:text-[5.4rem]">
              One care plan. <span className="italic text-coral">Every caregiver knows it.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-7 max-w-xl text-xl leading-relaxed text-muted-foreground">
              Care-Bridge keeps one approved plan for an older adult and makes sure the whole circle remembers it. Caregivers get one-minute briefs before each shift and an alert when only one person knows a warning sign. The person being cared for gets a simple chat they can ask.
            </p>
          </Reveal>
          <Reveal delay={0.24} className="mt-9 flex flex-wrap items-center gap-4">
            <TelegramLink variant="coral" />
            <a href="#problem" className="text-base font-semibold underline decoration-2 underline-offset-8 hover:text-coral">See the problem</a>
          </Reveal>
        </div>

        <Reveal delay={0.2} className="relative lg:col-span-5">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-t-[999px] rounded-b-[2.5rem] bg-teal ring-1 ring-border">
            <Image src="/images/care-duo.jpg" alt="A caregiver and an older woman looking at a phone together on a park bench" fill priority sizes="(min-width:1024px) 420px, 90vw" className="object-cover object-[28%_70%]" />
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
              {["One-minute briefs", "Warning signs first", "Every change reaches everyone", "A person approves every fact", "Runs in Telegram"].map((t) => (
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
                Care breaks down at the handoff.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Family, aides and nurses share the work. Each of them knows part of the plan.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                No one is careless. There is just no shared memory, and the person being cared for pays for the gaps.
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
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sun">How a detail gets missed</p>
                <h3 className="font-display mt-4 text-3xl font-medium leading-tight sm:text-5xl">The rule was written down. It never reached the aide on shift.</h3>
                <div className="relative mt-8 aspect-[16/10] overflow-hidden rounded-2xl">
                  <Image src="/images/care-kitchen.jpg" alt="A caregiver and an older woman going through a phone together at the kitchen table" fill sizes="(min-width:1024px) 440px, 90vw" className="object-cover" />
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
          <h2 className="font-display mt-4 text-4xl font-medium leading-[1.02] sm:text-6xl">One plan. Kept current. Remembered by everyone.</h2>
        </div>
        <div className="mt-12">
          <Showcase />
        </div>
      </section>

      {/* ============ PRINCIPLES ============ */}
      <section id="principles" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 md:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Principles</p>
          <h2 className="font-display mt-4 text-4xl font-medium leading-[1.02] sm:text-6xl">AI drafts. People decide.</h2>
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
              <h2 className="font-display text-4xl font-medium leading-[1.02] sm:text-6xl">Get the whole circle on the same page.</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-background/75">No new app to install. Open Telegram and add your first fact.</p>
              <div className="mt-8"><TelegramLink variant="coral" label="Open Care-Bridge" /></div>
            </div>
            <div className="relative min-h-72 lg:min-h-full">
              <Image src="/images/care-duo.jpg" alt="" fill sizes="(min-width:1024px) 560px, 100vw" className="object-cover object-[22%_70%]" />
              <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/10 to-transparent max-lg:bg-gradient-to-t" />
            </div>
          </div>
        </Reveal>
      </section>

      <Separator className="mx-auto max-w-6xl" />
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row md:px-8">
        <Logo />
        <p>Hackathon demo. All people and data shown are fictional. Photos from Pexels.</p>
      </footer>
    </main>
  );
}
