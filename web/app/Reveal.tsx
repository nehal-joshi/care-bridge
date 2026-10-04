"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ "--d": `${delay}s` } as CSSProperties}>
      {children}
    </div>
  );
}

export function Pull({ text, as: Tag = "h2", className = "" }: { text: string; as?: "h1" | "h2" | "h3"; className?: string }) {
  const ref = useInView<HTMLHeadingElement>();
  return (
    <Tag ref={ref} className={`pull ${className}`} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden style={{ "--d": `${i * 0.07}s`, marginRight: "0.25em" } as CSSProperties}>
          {w}
        </span>
      ))}
    </Tag>
  );
}

export function Chat({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`chat ${className}`}>
      {children}
    </div>
  );
}
