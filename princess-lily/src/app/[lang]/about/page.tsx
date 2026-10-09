import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, hasLocale } from "@/i18n";
import { pageMeta } from "@/lib/seo";
import Picture from "@/components/Picture";
import manifest from "@/lib/media-manifest.json";
import { getAuthorPhoto } from "@/lib/author";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return pageMeta(lang, "/about", t.pages.about.title, t.author.greeting);
}
export default async function About({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const lp = manifest["lily-portrait"];
  const photo = await getAuthorPhoto();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.pages.about.title}</p>
      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-14">
        <div className="mx-auto w-full max-w-xs md:sticky md:top-24 md:self-start">
          {photo && (
            <figure className="author-frame">
              <Picture base={photo.base} widths={photo.widths} width={photo.width} height={photo.height} alt={t.author.photoAlt} priority
                sizes="(min-width: 768px) 320px, 80vw" imgClassName="h-auto w-full object-cover" />
            </figure>
          )}
          <figure className="mt-12 flex items-center gap-4">
            <Picture base="/media/lily-portrait" widths={lp.widths} width={lp.width} height={lp.height} alt={t.author.portraitAlt}
              sizes="96px" className="w-24 shrink-0" imgClassName="aspect-square h-auto w-full rounded-full object-cover ring-4 ring-paper/80" />
            <figcaption className="text-sm text-ink-soft">{t.author.lilyCaption}</figcaption>
          </figure>
        </div>
        <article>
          <h1 className="text-4xl text-moss-900 sm:text-5xl">{t.author.greeting}</h1>
          <div className="prose-soft mt-6 text-lg text-ink-soft">{t.author.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
          <p className="mt-8 font-display text-2xl italic text-moss-900">{t.author.signoff}</p>
          <p className="font-display text-3xl font-semibold text-moss-900">{t.author.name}</p>
          <p className="text-ink-soft">{t.author.role}</p>
        </article>
      </div>
    </div>
  );
}
