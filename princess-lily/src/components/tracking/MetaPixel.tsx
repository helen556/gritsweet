"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsent } from "./consent";

/**
 * Meta Pixel: скрипт завантажується лише після згоди на рекламні cookie. PageView — один раз на кожну адресу
 * (без дублів при повторному рендері). Решта подій — trackPixel() у відповідних компонентах.
 */
export default function MetaPixel({ pixelId }: { pixelId: string }) {
  const granted = useConsent() === "granted";
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef("");

  useEffect(() => {
    if (!granted || window.fbq) return;
    /* стандартний завантажувач Meta: черга викликів до появи fbevents.js */
    const q: unknown[][] = [];
    const fbq = Object.assign((...args: unknown[]) => { const f = fbq as unknown as { callMethod?: (...a: unknown[]) => void }; if (f.callMethod) f.callMethod(...args); else q.push(args); },
      { queue: q, push: undefined as unknown, loaded: true, version: "2.0" });
    fbq.push = fbq;
    window.fbq = fbq;
    const s = document.createElement("script");
    s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    window.fbq("init", pixelId);
  }, [granted, pixelId]);

  useEffect(() => {
    if (!granted || !window.fbq) return;
    const url = `${pathname}?${search.toString()}`;
    if (last.current === url) return;
    last.current = url;
    window.fbq("track", "PageView");
  }, [granted, pathname, search]);

  return null;
}
