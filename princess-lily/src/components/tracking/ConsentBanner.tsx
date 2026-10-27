"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OPEN_CONSENT_EVENT, setConsent, useConsent } from "./consent";

type T = { text: string; accept: string; decline: string; more: string };

/** Запит згоди на рекламні cookie (лише коли підключено Meta Pixel). Вибір можна змінити в футері. */
export default function ConsentBanner({ lang, t }: { lang: "uk" | "en"; t: T }) {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);
  if (consent !== null && !reopened) return null;
  const choose = (v: "granted" | "denied") => { setConsent(v); setReopened(false); };
  return (
    <div role="dialog" aria-live="polite" aria-label={t.more} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-black/10 bg-paper/95 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,.45)] backdrop-blur sm:p-5">
      <p className="text-[0.95rem] text-ink">{t.text} <Link className="underline" href={`/${lang}/privacy`}>{t.more}</Link></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => choose("granted")}>{t.accept}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose("denied")}>{t.decline}</button>
      </div>
    </div>
  );
}

export function ConsentSettingsButton({ label }: { label: string }) {
  return <button type="button" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT))}>{label}</button>;
}
