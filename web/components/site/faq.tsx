"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  ["Do caregivers need to install anything?", "No. It runs in Telegram. Briefs arrive as messages, and the caregiver view opens as a Mini App."],
  ["Can the AI change the care plan?", "No. It drafts facts. Only the primary caregiver can approve them."],
  ["What happens when the plan changes?", "The fact gets a new version. Anyone who hasn't seen it gets it first in their next brief, and the change is logged."],
  ["Who sees what?", "Each fact has an audience. The older adult never sees caregiver-only notes."],
  ["Where does the data live?", "On one computer at home. The AI models run there too, not in the cloud."],
  ["Does it give medical advice?", "No. It repeats the approved plan and points to the nurse line, or 911 in an emergency."],
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
