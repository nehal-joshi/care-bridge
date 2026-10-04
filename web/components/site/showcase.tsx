"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, ClipboardCheck, ShieldCheck, MessageCircle, Check, AlertTriangle, Upload, Sparkles, Phone as PhoneIcon } from "lucide-react";

const tabs = [
  { v: "capture", label: "Capture", icon: FileText },
  { v: "brief", label: "Brief", icon: ClipboardCheck },
  { v: "coverage", label: "Coverage", icon: ShieldCheck },
  { v: "companion", label: "Companion", icon: MessageCircle },
];

const copy: Record<string, { k: string; h: string; p: string; points: string[] }> = {
  capture: {
    k: "Step 1",
    h: "Write it down once.",
    p: "Type a note or upload a discharge PDF. Care-Bridge drafts short facts, keeps the source of each one and flags what changed. You approve each fact before anyone sees it.",
    points: ["Every fact keeps its source and version", "Nothing goes live until a person approves it", "Warning signs rank above routines"],
  },
  brief: {
    k: "Step 2",
    h: "A one-minute brief before each shift.",
    p: "Up to five question cards in Telegram. Changed facts come first, then whatever you're about to forget.",
    points: ["Spaced repetition picks what's due", "Warning signs get a higher recall target", "Edited facts jump to the top"],
  },
  coverage: {
    k: "Step 3",
    h: "See who knows what.",
    p: "For each warning sign, see how likely each caregiver is to remember it today. Get an alert when only one person knows it.",
    points: ["Green, amber or red against a target", "An alert when a warning sign has no backup", "A log of every change and who made it"],
  },
  companion: {
    k: "For the older adult",
    h: "A simple chat for the person at the centre.",
    p: "They ask questions in their own words. The bot answers only from the approved plan, one step at a time. It asks before telling anyone, unless it's an emergency.",
    points: ["\"Show me\" opens a step-by-step 3D guide", "Caregiver-only notes stay hidden", "Never gives new medical advice"],
  },
};

function Phone({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="mx-auto w-full max-w-[320px] rounded-[2.4rem] bg-foreground p-2.5 shadow-[0_30px_60px_-20px_rgba(14,47,46,.5)]">
      <div className="min-h-[470px] rounded-[1.9rem] bg-paper p-4">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-foreground/15" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function CaptureUI() {
  return (
    <Phone title="Add to the plan">
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-teal/40 bg-sky/40 p-3 text-sm">
        <Upload className="size-5 text-teal" aria-hidden />
        <div>
          <p className="font-semibold">Add anything you know</p>
          <p className="text-muted-foreground">Notes, lists, documents. 6 drafts found</p>
        </div>
      </div>
      {[
        ["Weight up more than 3 lb overnight: call the heart failure nurse.", "Warning sign", "bg-coral/15 text-coral"],
        ["Take evening medicines with food.", "Routine", "bg-sun/25 text-[#8a5d00]"],
      ].map(([t, b, c]) => (
        <div key={t} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{b}</span>
          <p className="mt-2 text-sm leading-snug">{t}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Sparkles className="size-3" aria-hidden /> Drafted from your note</span>
            <span className="rounded-full bg-foreground px-3 py-1 font-semibold text-background">Approve</span>
          </div>
        </div>
      ))}
    </Phone>
  );
}

function BriefUI() {
  return (
    <Phone title="Today's brief · 3 of 5">
      <div className="rounded-2xl bg-teal p-4 text-background">
        <Badge className="bg-sun text-foreground hover:bg-sun">Changed</Badge>
        <p className="font-display mt-3 text-xl leading-snug">The scale reads 3 lb higher than yesterday. What do you do?</p>
        <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm text-background/80">phone her nurse</div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-ok-soft p-3 text-sm ring-1 ring-teal/20" style={{ background: "#dcefe3" }}>
        <Check className="size-4 text-teal" aria-hidden />
        <span><b>Correct.</b> Call the heart failure nurse.</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        <span className="rounded-xl bg-white py-2.5 ring-1 ring-border">Didn&apos;t know</span>
        <span className="rounded-xl bg-white py-2.5 ring-1 ring-border">Partly</span>
        <span className="rounded-xl bg-foreground py-2.5 text-background">Knew it</span>
      </div>
    </Phone>
  );
}

const cellTone = { ok: "bg-[#8fcf9b] text-foreground", mid: "bg-sun text-foreground", low: "bg-coral text-white" } as const;
function CoverageUI() {
  const rows: [string, (keyof typeof cellTone)[]][] = [
    ["Weight rule", ["ok", "low", "ok"]],
    ["Allergy", ["ok", "ok", "ok"]],
    ["Walker brakes", ["ok", "mid", "ok"]],
    ["New confusion", ["ok", "ok", "mid"]],
  ];
  return (
    <Phone title="Coverage">
      <div className="grid grid-cols-[1.3fr_repeat(3,1fr)] gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-left">Sign</span><span>Primary</span><span>Aide</span><span>Family</span>
      </div>
      {rows.map(([n, c]) => (
        <div key={n} className="grid grid-cols-[1.3fr_repeat(3,1fr)] items-center gap-1.5">
          <span className="text-xs font-medium leading-tight">{n}</span>
          {c.map((x, i) => (
            <span key={i} className={`h-8 rounded-lg ${cellTone[x]}`} />
          ))}
        </div>
      ))}
      <div className="flex gap-2 rounded-2xl bg-coral/12 p-3 text-xs leading-snug ring-1 ring-coral/30" style={{ background: "#fbe3d9" }}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden />
        <span>Only two people reliably know the weight rule. The weekday aide needs a refresher.</span>
      </div>
    </Phone>
  );
}

function CompanionUI() {
  return (
    <Phone title="Care-Bridge chat">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-teal px-3.5 py-2.5 text-sm text-background">My ankles look puffy today. What should I do?</div>
      <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm">Your care plan says to check your weight. Did it go up more than 3 pounds since yesterday?</div>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-teal px-3.5 py-2.5 text-sm text-background">Yes, about 4.</div>
      <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm">Then the plan says to call the heart failure nurse. Want me to show you the steps?</div>
      <div className="flex gap-2">
        <span className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white">Show me</span>
        <span className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-border"><PhoneIcon className="size-4" aria-hidden /> Call nurse</span>
      </div>
    </Phone>
  );
}

const uis: Record<string, React.ReactNode> = { capture: <CaptureUI />, brief: <BriefUI />, coverage: <CoverageUI />, companion: <CompanionUI /> };

export function Showcase() {
  return (
    <Tabs defaultValue="capture" className="gap-8">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-[2rem] bg-secondary p-1.5 sm:w-fit">
        {tabs.map(({ v, label, icon: Icon }) => (
          <TabsTrigger key={v} value={v} className="h-11 flex-none rounded-full px-5 text-base data-active:bg-foreground! data-active:text-background! text-foreground/70">
            <Icon aria-hidden /> {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map(({ v }) => (
        <TabsContent key={v} value={v} className="text-base">
          <div className="grid items-center gap-10 rounded-[2rem] bg-paper p-6 ring-1 ring-border sm:p-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">{copy[v].k}</p>
              <h3 className="font-display mt-4 text-3xl font-medium leading-tight sm:text-5xl">{copy[v].h}</h3>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{copy[v].p}</p>
              <ul className="mt-6 space-y-3">
                {copy[v].points.map((p) => (
                  <li key={p} className="flex gap-3 text-base">
                    <Check className="mt-1 size-5 shrink-0 text-teal" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[1.6rem] bg-sky/60 px-4 py-10">{uis[v]}</div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
