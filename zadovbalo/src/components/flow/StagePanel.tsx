"use client";

import { motion } from "motion/react";
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
}: {
  children: React.ReactNode;
  className?: string;
  focusOnMount?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLElement>(null);
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45 } }}
      transition={{ duration: 0.5 }}
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
        "font-display font-medium text-balance text-frost outline-none [text-shadow:0_2px_40px_rgb(8_19_28/0.55)]",
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
