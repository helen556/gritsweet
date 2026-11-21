"use client";
import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsent } from "./consent";

export const PIXEL_READY_EVENT = "pl-fbq-ready";

/**
 * Meta Pixel: стандартний базовий код Meta через next/script (afterInteractive) у спільному layout — на всіх сторінках обох мов.
 * Завантажується лише після згоди відвідувача на рекламні cookie (банер), тому без згоди нічого не надсилається.
 * PageView — при першому показі й при кожному клієнтському переході (зміна адреси), без дублів.
 * Рядок <noscript> з пікселем-картинкою не додаємо: без JavaScript відвідувач не може дати згоду.
 */
export default function MetaPixel({ pixelId }: { pixelId: string }) {
  const granted = useConsent() === "granted";
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef("");
  const url = `${pathname}?${search.toString()}`;

  useEffect(() => {
    if (!granted) return;
    const pageView = () => {
      if (typeof window.fbq !== "function" || last.current === url) return;
      last.current = url;
      window.fbq("track", "PageView");
    };
    pageView();
    window.addEventListener(PIXEL_READY_EVENT, pageView);
    return () => window.removeEventListener(PIXEL_READY_EVENT, pageView);
  }, [granted, url]);

  if (!granted) return null;
  const id = pixelId.replace(/\D/g, "");
  return (
    <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');
window.dispatchEvent(new Event('${PIXEL_READY_EVENT}'));
`}</Script>
  );
}
