"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";

export default function NotFound() {
  const p = useParams<{ lang?: string }>();
  const lang = p?.lang && hasLocale(p.lang) ? p.lang : "uk";
  const t = getDict(lang);
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="font-display text-7xl text-gold">404</p>
      <h1 className="mt-4 text-5xl text-moss-900">{t.notFound.title}</h1>
      <p className="mt-4 text-lg text-ink-soft">{t.notFound.text}</p>
      <Link href={`/${lang}`} className="btn btn-primary mt-8">{t.notFound.home}</Link>
    </div>
  );
}
