"use client";
import { useSyncExternalStore } from "react";

/**
 * Згода на необов'язкові (рекламні) трекери. Зберігається лише в браузері відвідувача.
 * Без згоди Meta Pixel не завантажується й жодна подія не надсилається.
 */
export type Consent = "granted" | "denied" | null;
const KEY = "pl_consent_ads_v1";
export const CONSENT_EVENT = "pl-consent";
export const OPEN_CONSENT_EVENT = "pl-consent-open";

export function getConsent(): Consent {
  try { const v = localStorage.getItem(KEY); return v === "granted" || v === "denied" ? v : null; } catch { return null; }
}
export function setConsent(v: "granted" | "denied") {
  try { localStorage.setItem(KEY, v); } catch {}
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v }));
}

const subscribe = (cb: () => void) => { window.addEventListener(CONSENT_EVENT, cb); return () => window.removeEventListener(CONSENT_EVENT, cb); };
/** Поточна згода; на сервері й до гідратації — "unknown" (банер не показуємо, піксель не вантажимо). */
export const useConsent = () => useSyncExternalStore<Consent | "unknown">(subscribe, getConsent, () => "unknown");

type Fbq = (...args: unknown[]) => void;
declare global { interface Window { fbq?: Fbq } }

/** Подія Meta Pixel — лише якщо піксель завантажено (тобто є згода). eventId — для дедуплікації з Conversions API. */
export function trackPixel(event: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase", params: Record<string, unknown>, eventId?: string) {
  if (getConsent() !== "granted" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params, eventId ? { eventID: eventId } : undefined);
}

/** Cookie _fbp/_fbc (ставить піксель) — передаються на сервер разом із замовленням для Conversions API. */
export function metaCookies() {
  const get = (n: string) => document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.slice(n.length + 1) ?? "";
  return { fbp: get("_fbp"), fbc: get("_fbc") };
}
