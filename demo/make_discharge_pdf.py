"""Generate the synthetic discharge PDF used in the Care-Bridge demo.

Run: services/api/.venv/bin/python demo/make_discharge_pdf.py
Everything in the document is fictional.
"""
from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).with_name("ruth-discharge-2026-10-02.pdf")

SECTIONS = [
    ("Why you were in hospital",
     ["You stayed 3 nights for a heart failure flare. Extra fluid built up in your legs and lungs. "
      "It has been removed with stronger water pills."]),
    ("Your medicines",
     ["CHANGED: Furosemide (water pill) is now 40 mg every morning at 8 am with breakfast. "
      "It was 20 mg. Never take it in the evening.",
      "NO CHANGE: Lisinopril 10 mg every morning.",
      "NO CHANGE: Metoprolol succinate 25 mg every evening.",
      "STOP: Do not take ibuprofen (Advil) or naproxen (Aleve). They make heart failure worse. "
      "Use acetaminophen (Tylenol) for pain."]),
    ("Weigh yourself every day",
     ["Weigh yourself every morning after using the toilet and before breakfast. "
      "Write the number on your weight sheet."]),
    ("Call the heart failure nurse line (555-0142) if",
     ["Your weight goes up more than 3 lb overnight or 5 lb in a week.",
      "Your ankles or legs are more swollen.",
      "You are more short of breath when walking, or need extra pillows to sleep."]),
    ("Call 911 if",
     ["You have chest pain, you faint, or you have severe trouble breathing at rest."]),
    ("Food and drink",
     ["Keep salt under 2,000 mg a day. Avoid canned soup and deli meat.",
      "Drink no more than 1.5 litres of fluid a day (about 6 cups), including soup and tea."]),
    ("Activity",
     ["Walk short distances every day with your walker. Lock both walker brakes before you stand up or sit down."]),
    ("Appointments",
     ["Blood test: Tuesday 6 October 2026, 9:00 am, Maplewood lab, ground floor.",
      "Heart clinic follow-up: Thursday 8 October 2026, 10:30 am, with Dr. Amara Okafor."]),
]


def main() -> None:
    pdf = FPDF(format="Letter")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_margins(20, 18, 20)

    pdf.set_fill_color(255, 236, 179)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 8, "SYNTHETIC DEMO DOCUMENT - fictional patient and hospital - not medical advice",
             align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 9, "Maplewood Community Hospital", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 7, "Discharge instructions - Heart failure", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 10)
    for line in ("Patient: Ruth Alvarez, age 78",
                 "Discharged: Friday 2 October 2026",
                 "Doctor: Dr. Amara Okafor, cardiology",
                 "Questions after you get home: heart failure nurse line 555-0142"):
        pdf.cell(0, 6, line, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    for heading, items in SECTIONS:
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, heading, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 11)
        for item in items:
            prefix = "- " if len(items) > 1 else ""
            pdf.multi_cell(0, 6, prefix + item, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
        pdf.ln(2)

    pdf.set_y(-28)
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 4, "Created for the Care-Bridge hackathon demo. Ruth Alvarez, Dr. Okafor and "
                         "Maplewood Community Hospital are fictional. Phone numbers use the 555 fictional range.")
    pdf.output(str(OUT))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
