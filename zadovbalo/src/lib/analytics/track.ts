"use client";

import type { AnalyticsEvent } from "./events";

/** Загальна подія без вмісту. Помилки доставки ігноруються. Поважає Do Not Track. */
export function track(event: AnalyticsEvent) {
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  const body = JSON.stringify({ event });
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // ignore
  }
}
