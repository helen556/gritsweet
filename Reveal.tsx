"use client";
import { useEffect, useRef } from "react";

/** Делікатна поява секції при прокручуванні. Без JS або з reduced-motion зміст видимий одразу. */
export function Reveal({ children, className = "", as: Tag = "div", delay = 0 }: { children: React.ReactNode; className?: string; as?: "div" | "section" | "li" | "article"; delay?: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("in"); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T = Tag as any;
  return <T ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</T>;
}
