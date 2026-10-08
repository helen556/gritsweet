import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { listPublicProducts } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/books">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return pageMeta(lang, "/books", t.catalog.title, t.catalog.intro);
}

export default async function Books({ params, searchParams }: PageProps<"/[lang]/books">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const sp = await searchParams;
  const fl = typeof sp.book === "string" && ["uk", "en"].includes(sp.book) ? sp.book : null;
  const ff = typeof sp.format === "string" && ["pdf", "print"].includes(sp.format) ? sp.format : null;
  const all = await listPublicProducts(lang);
  const langs = [...new Set(all.flatMap((p) => p.variants.map((v) => v.book_locale)))];
  const formats = [...new Set(all.flatMap((p) => p.variants.map((v) => v.format)))];
  const products = all.filter((p) => p.variants.some((v) => (!fl || v.book_locale === fl) && (!ff || v.format === ff)));
  const href = (k: "book" | "format", v: string | null) => {
    const q = new URLSearchParams();
    const book = k === "book" ? v : fl, format = k === "format" ? v : ff;
    if (book) q.set("book", book); if (format) q.set("format", format);
    const s = q.toString();
    return `/${lang}/books${s ? `?${s}` : ""}`;
  };
  // Фільтр показуємо лише тоді, коли є з чого обирати (без громіздких порожніх фільтрів)
  const groups = [
    langs.length > 1 && { key: "book" as const, label: t.catalog.bookLanguage, cur: fl, opts: langs.map((l) => [l, t.bookLocales[l]] as const) },
    formats.length > 1 && { key: "format" as const, label: t.catalog.format, cur: ff, opts: formats.map((f) => [f, t.formats[f]] as const) },
  ].filter(Boolean) as { key: "book" | "format"; label: string; cur: string | null; opts: (readonly [string, string])[] }[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-5xl text-moss-900 sm:text-6xl">{t.catalog.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{t.catalog.intro}</p>
      {groups.length > 0 && (
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:gap-10">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-label={g.label}>
              <p className="mb-2 text-sm font-semibold text-ink-soft">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={href(g.key, null)} className="chip" aria-pressed={!g.cur}>{t.catalog.all}</Link>
                {g.opts.map(([v, l]) => <Link key={v} href={href(g.key, v)} className="chip" aria-pressed={g.cur === v}>{l}</Link>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <div aria-live="polite">
        {products.length ? (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => <li key={p.id}><ProductCard p={p} lang={lang} t={t} headingLevel="h2" /></li>)}
          </ul>
        ) : <p className="mt-10 text-ink-soft">{t.catalog.empty}</p>}
      </div>
    </div>
  );
}
