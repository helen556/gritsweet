"use client";
import { useParams } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const p = useParams<{ lang?: string }>();
  const t = getDict(p?.lang && hasLocale(p.lang) ? p.lang : "uk");
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6" role="alert">
      <h1 className="text-5xl text-moss-900">{t.error.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">{t.error.text}</p>
      <button type="button" onClick={() => retry()} className="btn btn-primary mt-8">{t.error.retry}</button>
    </div>
  );
}
