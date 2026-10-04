export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 40 40" className="size-9" aria-hidden>
        <rect width="40" height="40" rx="12" fill="#14504d" />
        <path d="M6 27h28" stroke="#f4eee2" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M9 27c0-8 5-12 11-12s11 4 11 12" fill="none" stroke="#f4b73f" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M14 27v-6M20 27v-12M26 27v-6" stroke="#f4eee2" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">Care-Bridge</span>
    </span>
  );
}
