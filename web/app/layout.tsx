import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "WONK", "opsz"] });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });

export const metadata: Metadata = {
  title: "Care-Bridge · one care plan, every caregiver knows it",
  description:
    "One approved care plan for an older adult, remembered by the whole circle. One-minute briefs before each shift, an alert when only one person knows a warning sign, and a simple chat for the person being cared for. All in Telegram.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
