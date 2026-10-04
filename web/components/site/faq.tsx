"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  ["Do caregivers need to install anything?", "No. Care-Bridge runs inside Telegram. Briefs and reminders arrive as chat messages, and the caregiver panel opens as a Telegram Mini App."],
  ["Can the AI change the care plan?", "No. The model drafts facts, questions and answers, and only the primary caregiver can approve them. It never approves a fact, messages the circle or judges anyone's health on its own."],
  ["What happens when the plan changes?", "Editing a fact bumps its version. Anyone who has not seen the new version gets it at the top of their next brief, and the change shows up in the feed."],
  ["Who sees what?", "Each fact has an audience. Caregiver-only facts are filtered out before the companion for the older adult ever sees anything."],
  ["Does it replace medical advice?", "No. It repeats the approved care plan and points to the nurse line. It never offers new medical advice."],
];

export function Faq() {
  return (
    <Accordion className="w-full divide-y divide-border rounded-[1.6rem] bg-paper px-6 ring-1 ring-border sm:px-8">
      {faqs.map(([q, a], i) => (
        <AccordionItem key={q} value={`i${i}`} className="border-0">
          <AccordionTrigger className="py-6 text-left text-lg font-semibold hover:no-underline sm:text-xl">{q}</AccordionTrigger>
          <AccordionContent className="pb-6 text-lg leading-relaxed text-muted-foreground">{a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
