"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Поява секцій ([data-reveal]) один раз при вході у viewport та дуже слабкий паралакс
 * декоративної зелені ([data-parallax]) лише на desktop. Лише transform/opacity.
 */
export default function MotionEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"));
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((e) => io.observe(e));
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
