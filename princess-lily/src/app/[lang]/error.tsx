"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";

let autoRetried = false;
import { getDict, hasLocale } from "@/i18n";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const p = useParams<{ lang?: string }>();
  const t = getDict(p?.lang && hasLocale(p.lang) ? p.lang : "uk");
  // разовий тихий повтор: короткочасний збій з'єднання користувач навіть не помітить
  useEffect(() => {
    if (autoRetried) return;
    autoRetried = true;
    const id = setTimeout(() => retry(), 1200);
    return () => clearTimeout(id);
  }, [retry]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6" role="alert">
      <h1 className="text-5xl text-plum-900">{t.error.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">{t.error.text}</p>
      <button type="button" onClick={() => retry()} className="btn btn-primary mt-8">{t.error.retry}</button>
    </div>
  );
}
