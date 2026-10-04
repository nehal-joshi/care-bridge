import { Send, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/CareBridgeBot";

export function TelegramLink({
  label = "Open in Telegram",
  variant = "dark",
  className,
}: {
  label?: string;
  variant?: "dark" | "light" | "coral";
  className?: string;
}) {
  const tone =
    variant === "dark"
      ? "bg-foreground text-background hover:bg-teal"
      : variant === "coral"
        ? "bg-coral text-white hover:bg-[#d95a2d]"
        : "bg-paper text-foreground hover:bg-white";
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 rounded-full px-6 text-base font-semibold", tone, className)}
    >
      <Send className="size-4" aria-hidden />
      {label}
      <ArrowUpRight className="size-4" aria-hidden />
    </a>
  );
}
