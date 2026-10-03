"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Обгортка етапу. Після появи переносить фокус на заголовок (tabIndex=-1),
 * щоб клавіатура й скрінрідер «переходили» разом з екраном.
 */
export function StagePanel({
  children,
  className,
  focusOnMount = true,
  label,
  visibleOnLoad = false,
}: {
  children: React.ReactNode;
  className?: string;
  focusOnMount?: boolean;
  label: string;
  /** Перший екран: видимий у серверному HTML, без очікування JS (важливо для LCP). */
  visibleOnLoad?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!focusOnMount) return;
    const heading = ref.current?.querySelector<HTMLElement>("[data-stage-heading]");
    heading?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <motion.section
      ref={ref}
      aria-label={label}
      className={cn("relative mx-auto flex w-full max-w-5xl flex-col items-center text-center", className)}
      // Просторовий перехід: попередній екран відходить углиб, новий наближається з глибини.
      style={{ transformPerspective: 1200 }}
      initial={visibleOnLoad ? false : reduced ? { opacity: 0 } : { opacity: 0, scale: 1.06, y: 18, rotateX: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0.2 } }
          : { opacity: 0, scale: 0.9, y: -14, rotateX: 6, filter: "blur(6px)", transition: { duration: 0.5, ease: [0.4, 0, 0.6, 1] } }
      }
      transition={{ duration: reduced ? 0.25 : 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}

/** Великий заголовок етапу — основний візуальний герой. */
export function StageHeading({
  children,
  className,
  size = "giant",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "mega" | "giant" | "title";
}) {
  return (
    <h1
      data-stage-heading
      tabIndex={-1}
      className={cn(
        "font-display font-medium text-balance text-frost outline-none [text-shadow:0_2px_40px_rgb(10_11_12/0.6)]",
        size === "mega" && "text-mega",
        size === "giant" && "text-giant",
        size === "title" && "text-title",
        className,
      )}
    >
      {children}
    </h1>
  );
}
