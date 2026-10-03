"use client";

import type { AnalyticsPayload } from "./events";

/** Агреговані події без тексту. Помилки доставки ігноруються — аналітика не має ламати досвід. */
export function track(event: AnalyticsPayload["event"], props: Omit<AnalyticsPayload, "event"> = {}) {
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  const body = JSON.stringify({ event, ...props });
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // ignore
  }
}
