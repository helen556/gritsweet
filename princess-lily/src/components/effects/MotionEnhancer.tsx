"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Поява секцій ([data-reveal]) один раз при вході у viewport: заголовки й короткі тексти виїжджають
 * зліва/справа (data-reveal="left" | "right" | "up" | "auto" — чергування), з появою прозорості.
 * Контент ховається лише після запуску скрипта (html.reveal-ready) — без JS усе видно. Також дуже слабкий паралакс
 * декоративної зелені ([data-parallax]) лише на desktop. Лише transform/opacity.
 */
export default function MotionEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"));
    // Без IntersectionObserver або при reduced motion — нічого не ховаємо
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }
    // «auto» — чергування напрямку зліва/справа в межах секції
    document.querySelectorAll<HTMLElement>("section, [data-reveal-group]").forEach((sec) => {
      let i = 0;
      sec.querySelectorAll<HTMLElement>('[data-reveal="auto"]').forEach((e) => { e.dataset.reveal = i++ % 2 ? "right" : "left"; });
    });
    // Те, що вже у viewport, показуємо одразу (без мигання), решту — при появі
    const vh = window.innerHeight;
    els.forEach((e) => { const r = e.getBoundingClientRect(); if (r.top < vh * 0.92 && r.bottom > 0) e.classList.add("is-in"); });
    // Ховати контент можна лише тепер, коли JS гарантовано працює
    root.classList.add("reveal-ready");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    els.filter((e) => !e.classList.contains("is-in")).forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [pathname]);

  useEffect(() => {
    const ok = window.matchMedia("(min-width: 1024px) and (hover: hover) and (prefers-reduced-motion: no-preference)");
    if (!ok.matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    if (!els.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      for (const el of els) {
        const f = Number(el.dataset.parallax) || 0.05;
        el.style.transform = `translate3d(0, ${(y * f).toFixed(1)}px, 0)`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [pathname]);

  return null;
}
