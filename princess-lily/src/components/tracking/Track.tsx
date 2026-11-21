"use client";
import { useEffect, useRef } from "react";
import { CONSENT_EVENT } from "./consent";
import { PIXEL_READY_EVENT } from "./MetaPixel";
import { trackInitiateCheckout, trackPurchase, trackViewContent, type PixelLine } from "@/lib/pixel";

type Props =
  | { event: "ViewContent"; data: { id: string; name: string; price: number } }
  | { event: "InitiateCheckout"; data: { lines: PixelLine[]; value: number } }
  | { event: "Purchase"; data: { orderId: string; eventId: string; lines: PixelLine[]; value: number } };

/**
 * Одна подія Meta Pixel на показ сторінки (для серверних сторінок, які самі не можуть викликати fbq).
 * Якщо піксель ще вантажиться або згоду дають уже на сторінці — подія надсилається, щойно він готовий.
 */
export default function Track(props: Props) {
  const sent = useRef(false);
  const json = JSON.stringify(props);
  useEffect(() => {
    const p = JSON.parse(json) as Props;
    const fire = () => {
      if (sent.current) return;
      sent.current = p.event === "ViewContent" ? trackViewContent(p.data)
        : p.event === "InitiateCheckout" ? trackInitiateCheckout(p.data)
        : trackPurchase(p.data);
    };
    let id = setTimeout(fire, 50);
    const again = () => { clearTimeout(id); id = setTimeout(fire, 50); };
    window.addEventListener(CONSENT_EVENT, again);
    window.addEventListener(PIXEL_READY_EVENT, again);
    return () => { clearTimeout(id); window.removeEventListener(CONSENT_EVENT, again); window.removeEventListener(PIXEL_READY_EVENT, again); };
  }, [json]);
  return null;
}
