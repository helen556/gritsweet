import Link from "next/link";
import type { Metadata } from "next";
import { getDict, hasLocale } from "@/i18n";
import { notFound } from "next/navigation";
import Hero from "@/components/Hero";
import Picture from "@/components/Picture";
import ProductCard from "@/components/ProductCard";
import Faq from "@/components/Faq";
import { Sprig } from "@/components/Leaves";
import ContactDetails from "@/components/ContactDetails";
import { listPublicProducts } from "@/lib/catalog";
import { pdfDeliveryMode } from "@/lib/storefront";
import { pageMeta } from "@/lib/seo";
import manifest from "@/lib/media-manifest.json";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return { ...pageMeta(lang, "/", t.meta.homeTitle, t.meta.homeDescription), title: { absolute: t.meta.homeTitle } };
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const [products, pdfMode] = await Promise.all([listPublicProducts(lang), pdfDeliveryMode()]);
  const lu = manifest["characters-lineup"], lp = manifest["lily-portrait"];

  return (
    <>
      <Hero lang={lang} t={{ ...t.hero, title: t.brand.name, slogan: t.brand.slogan, ageLine: t.product.age(2, 6) }} />

      {/* Про серію */}
      <section id="series" aria-labelledby="series-title" className="relative scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
          <div data-reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.series.kicker}</p>
            <h2 id="series-title" className="mt-3 text-4xl text-moss-900 sm:text-5xl">{t.series.lead}</h2>
            <div className="prose-soft mt-6 max-w-[62ch] text-ink-soft">
              {t.series.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <p className="mt-8 border-l-2 border-gold pl-5 font-display text-2xl italic leading-snug text-moss-900">{t.series.closing}</p>
          </div>
          <div data-reveal className="self-center">
            <Picture base="/media/characters-lineup" widths={lu.widths} width={lu.width} height={lu.height} alt={t.series.lineupAlt}
              sizes="(min-width: 1024px) 480px, 92vw" imgClassName="h-auto w-full rounded-[2rem] bg-paper object-contain mix-blend-multiply" />
          </div>
        </div>
      </section>

      {/* Книжки */}
      <section aria-labelledby="books-title" className="bg-cream/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4" data-reveal>
            <h2 id="books-title" className="text-4xl text-moss-900 sm:text-5xl">{t.catalog.homeTitle}</h2>
            <Link href={`/${lang}/books`} className="btn btn-ghost btn-sm">{t.catalog.more}</Link>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => <li key={p.id} data-reveal><ProductCard p={p} lang={lang} t={t} /></li>)}
            {products.length < 3 && (
              // Текст — з FAQ №15 джерела; без вигаданих назв майбутніх книжок
              <li data-reveal className={products.length === 1 ? "lg:col-span-2" : ""}>
                <div className="card relative flex h-full flex-col justify-center overflow-hidden border-dashed bg-moss-100/50 p-8 sm:p-10">
                  <Sprig className="pointer-events-none absolute -bottom-6 right-6 hidden h-40 w-24 text-moss-500/50 lg:block" />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.faq.items[14].q}</p>
                  <p className="mt-4 max-w-md font-display text-3xl leading-snug text-moss-900">{t.faq.items[14].a[0]}</p>
                  <p className="mt-3 max-w-md text-ink-soft">{t.faq.items[14].a[1]}</p>
                </div>
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* Переваги */}
      <section aria-labelledby="benefits-title" className="relative overflow-hidden py-16 sm:py-24">
        <Sprig className="pointer-events-none absolute -right-6 top-10 hidden h-48 w-28 text-moss-500/70 lg:block" flip parallax={0.03} />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="benefits-title" className="text-4xl text-moss-900 sm:text-5xl" data-reveal>{t.benefits.title}</h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.benefits.items.map((b) => (
              <li key={b.title} className="card p-6" data-reveal>
                <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl bg-moss-100 text-2xl">{b.icon}</span>
                <h3 className="mt-4 text-2xl text-moss-900">{b.title}</h3>
                <p className="mt-2 text-ink-soft">{b.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Авторка */}
      <section aria-labelledby="author-title" className="bg-moss-100/60 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
          <div data-reveal className="mx-auto w-full max-w-sm">
            <Picture base="/media/lily-portrait" widths={lp.widths} width={lp.width} height={lp.height} alt={t.author.portraitAlt}
              sizes="(min-width: 1024px) 380px, 80vw" imgClassName="aspect-square h-auto w-full rounded-full object-cover shadow-[0_24px_50px_-28px_rgba(38,61,45,.6)] ring-8 ring-paper/70" />
          </div>
          <div data-reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.author.kicker}</p>
            <h2 id="author-title" className="mt-3 text-4xl text-moss-900 sm:text-5xl">{t.author.greeting}</h2>
            <div className="prose-soft mt-6 max-w-[62ch] text-ink-soft">
              {t.author.paragraphs.slice(0, 3).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <Link href={`/${lang}/about`} className="btn btn-ghost mt-8">{t.author.more}</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 id="faq-title" className="text-4xl text-moss-900 sm:text-5xl" data-reveal>{t.faq.title}</h2>
          <div className="mt-10" data-reveal><Faq lang={lang} t={t} pdfMode={pdfMode} /></div>
        </div>
      </section>

      {/* Контакти */}
      <section aria-labelledby="contact-title" className="pb-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="card flex flex-col gap-6 p-8 sm:p-10 md:flex-row md:items-center md:justify-between" data-reveal>
            <div>
              <h2 id="contact-title" className="text-3xl text-moss-900 sm:text-4xl">{t.contact.title}</h2>
              <p className="mt-2 max-w-xl text-ink-soft">{t.contact.intro}</p>
              <ContactDetails lang={lang} t={t} compact />
            </div>
            <Link href={`/${lang}/contacts`} className="btn btn-primary self-start md:self-center">{t.contact.send}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
