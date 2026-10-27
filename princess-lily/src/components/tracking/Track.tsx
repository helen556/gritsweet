"use client";
import { useEffect, useRef } from "react";
import { CONSENT_EVENT, trackPixel } from "./consent";

type Ev = "ViewContent" | "InitiateCheckout" | "Purchase";

/**
 * Одна подія Meta Pixel на показ сторінки. Якщо згоду дають уже на сторінці — подія надсилається тоді.
 * onceKey — захист від повтору між сеансами (Purchase: одна покупка = одна подія навіть при оновленні сторінки).
 */
export default function Track({ event, params, eventId, onceKey }: { event: Ev; params: Record<string, unknown>; eventId?: string; onceKey?: string }) {
  const sent = useRef(false);
  const json = JSON.stringify(params);
  useEffect(() => {
    const fire = () => {
      if (sent.current) return;
      if (onceKey) { try { if (localStorage.getItem(onceKey)) { sent.current = true; return; } } catch {} }
      if (typeof window.fbq !== "function") return;
      trackPixel(event, JSON.parse(json), eventId);
      sent.current = true;
      if (onceKey) { try { localStorage.setItem(onceKey, "1"); } catch {} }
    };
    // піксель ініціалізується в ефекті MetaPixel — даємо йому відпрацювати (і після згоди, наданої вже на сторінці)
    let id = setTimeout(fire, 50);
    const onConsent = () => { clearTimeout(id); id = setTimeout(fire, 50); };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => { clearTimeout(id); window.removeEventListener(CONSENT_EVENT, onConsent); };
  }, [event, json, eventId, onceKey]);
  return null;
}
