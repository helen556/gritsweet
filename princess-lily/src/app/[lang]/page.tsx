import Link from "next/link";
import type { Metadata } from "next";
import { getDict, hasLocale } from "@/i18n";
import { notFound } from "next/navigation";
import Hero from "@/components/Hero";
import Picture from "@/components/Picture";
import ProductCard from "@/components/ProductCard";
import Faq from "@/components/Faq";
import Ambient from "@/components/Ambient";
import { getAuthorPhoto } from "@/lib/author";
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
  const [products, pdfMode, authorPhoto] = await Promise.all([listPublicProducts(lang), pdfDeliveryMode(), getAuthorPhoto()]);
  const lu = manifest["characters-lineup"], lp = manifest["lily-portrait"];

  return (
    <>
      <Hero lang={lang} t={{ cta: t.hero.cta, pause: t.hero.pause, play: t.hero.play, replay: t.hero.replay, videoLabel: t.hero.videoLabel, posterAlt: t.hero.posterAlt, title: t.brand.name, slogan: t.brand.slogan }} />

      <div className="home-flow">
        <Ambient />

        {/* Про серію */}
        <section id="series" aria-labelledby="series-title" className="relative scroll-mt-20 pb-14 pt-20 sm:pb-20 sm:pt-28">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.series.kicker}</p>
              <h2 id="series-title" className="mt-3 text-4xl text-moss-900 sm:text-5xl">{t.series.lead}</h2>
              <div className="prose-soft mt-6 max-w-[62ch] text-ink-soft">
                {t.series.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <p className="mt-8 border-l-2 border-gold pl-5 font-display text-2xl italic leading-snug text-moss-900">{t.series.closing}</p>
            </div>
            <figure data-reveal className="relative self-center lg:mt-24">
              <div className="absolute -inset-2 -z-10 rounded-[50%] sm:-inset-6 bg-[radial-gradient(closest-side,rgba(255,252,244,.95),rgba(255,252,244,0))]" aria-hidden="true" />
              <Picture base="/media/characters-lineup" widths={lu.widths} width={lu.width} height={lu.height} alt={t.series.lineupAlt}
                sizes="(min-width: 1024px) 480px, 92vw" imgClassName="h-auto w-full object-contain mix-blend-multiply" />
            </figure>
          </div>
        </section>

        {/* Книжки */}
        <section aria-labelledby="books-title" className="py-14 sm:py-20">
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
                  <div className="surface surface-sage relative flex h-full flex-col justify-center overflow-hidden p-8 sm:p-12">
                    <Picture base="/media/lily-portrait" widths={lp.widths} width={lp.width} height={lp.height} alt=""
                      sizes="200px" className="pointer-events-none absolute -bottom-8 -right-6 hidden w-52 opacity-90 lg:block" imgClassName="h-auto w-full rounded-full [mask-image:radial-gradient(closest-side,#000_70%,transparent)]" />
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.faq.items[14].q}</p>
                    <p className="mt-4 max-w-md font-display text-3xl leading-snug text-moss-900">{t.faq.items[14].a[0]}</p>
                    <p className="mt-3 max-w-md text-ink-soft">{t.faq.items[14].a[1]}</p>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* Переваги: асиметричний ритм, легкі поверхні */}
        <section aria-labelledby="benefits-title" className="relative py-14 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="benefits-title" className="max-w-xl text-4xl text-moss-900 sm:text-5xl" data-reveal>{t.benefits.title}</h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {t.benefits.items.map((b, i) => (
                <li key={b.title} className={`surface p-6 sm:p-7 ${i % 2 ? "lg:translate-y-10" : ""}`} data-reveal>
                  <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffdf6,#e8eee1)] text-2xl shadow-[0_6px_14px_-8px_rgba(38,61,45,.4)]">{b.icon}</span>
                  <h3 className="mt-5 text-2xl text-moss-900">{b.title}</h3>
                  <p className="mt-2 text-ink-soft">{b.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Авторка: справжнє фото, текст, делікатний декор */}
        <section aria-labelledby="author-title" className="relative py-16 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            {authorPhoto ? (
              <figure data-reveal className="author-frame mx-auto w-full max-w-[22rem] lg:max-w-none">
                <Picture base={authorPhoto.base} widths={authorPhoto.widths} width={authorPhoto.width} height={authorPhoto.height} alt={t.author.photoAlt}
                  sizes="(min-width: 1024px) 420px, 88vw" imgClassName="h-auto w-full object-cover" />
              </figure>
            ) : null}
            <div data-reveal className={authorPhoto ? "" : "lg:col-span-2 lg:max-w-3xl"}>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-copper">{t.author.kicker}</p>
              <h2 id="author-title" className="mt-3 text-4xl text-moss-900 sm:text-5xl">{t.author.greeting}</h2>
              <div className="prose-soft mt-6 max-w-[62ch] text-ink-soft">
                {t.author.paragraphs.slice(0, 3).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <p className="mt-6 font-display text-2xl italic text-moss-900">{t.author.name}</p>
              <Link href={`/${lang}/about`} className="btn btn-ghost mt-6">{t.author.more}</Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-14 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 id="faq-title" className="text-center text-4xl text-moss-900 sm:text-5xl" data-reveal>{t.faq.title}</h2>
            <div className="mt-10" data-reveal><Faq lang={lang} t={t} pdfMode={pdfMode} /></div>
          </div>
        </section>

        {/* Контакти */}
        <section aria-labelledby="contact-title" className="pb-6 pt-6 sm:pt-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="surface surface-sage relative flex flex-col gap-6 overflow-hidden p-8 sm:p-12 md:flex-row md:items-center md:justify-between" data-reveal>
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(255,248,230,.95),rgba(255,248,230,0))]" />
              <div className="relative">
                <h2 id="contact-title" className="text-3xl text-moss-900 sm:text-4xl">{t.contact.title}</h2>
                <p className="mt-2 max-w-xl text-ink-soft">{t.contact.intro}</p>
                <ContactDetails lang={lang} t={t} compact />
              </div>
              <Link href={`/${lang}/contacts`} className="btn btn-primary relative self-start md:self-center">{t.contact.send}</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
