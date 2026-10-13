import Link from "next/link";
import type { Metadata } from "next";
import { getDict, hasLocale } from "@/i18n";
import { notFound } from "next/navigation";
import Hero from "@/components/Hero";
import Picture from "@/components/Picture";
import ProductCard, { ComingSoonCard } from "@/components/ProductCard";
import Faq from "@/components/Faq";
import Decor, { DECOR } from "@/components/Decor";
import Spreads from "@/components/Spreads";
import { getAuthorPhoto, getBooksPhoto } from "@/lib/author";
import { listPublicProducts, listPublicSpreads } from "@/lib/catalog";
import { pdfDeliveryMode } from "@/lib/storefront";
import { effectivePaymentMode } from "@/lib/orders";
import { pageMeta } from "@/lib/seo";
import manifest from "@/lib/media-manifest.json";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDict(lang);
  return { ...pageMeta(lang, "/", t.meta.homeTitle, t.meta.homeDescription), title: { absolute: t.meta.homeTitle } };
}

/** Сітка каталогу підлаштовується під кількість книжок: 1–3 в ряд на комп'ютері, без «порожніх» карток. */
function gridCols(n: number) {
  if (n <= 1) return "sm:grid-cols-1 sm:max-w-sm";
  if (n === 2) return "sm:grid-cols-2 lg:max-w-4xl";
  if (n === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

const kicker = "text-sm font-semibold uppercase tracking-[0.18em] text-copper";
const h2 = "text-4xl text-plum-900 sm:text-5xl";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDict(lang);
  const [products, spreads, pdfMode, payMode, authorPhoto, booksPhoto] = await Promise.all([
    listPublicProducts(lang), listPublicSpreads(lang), pdfDeliveryMode(), effectivePaymentMode(), getAuthorPhoto(), getBooksPhoto(),
  ]);
  const lu = manifest["characters-lineup"];
  const d = t.pages.delivery;
  const payText = payMode === "provider" ? d.paymentProvider : payMode === "manual_link" ? d.paymentManual : d.paymentDisabled;

  return (
    <>
      <Hero ctaHref="#catalog" t={{ title: t.brand.name, slogan: t.brand.slogan, intro: t.hero.intro, cta: t.hero.cta, pause: t.hero.pause, play: t.hero.play, videoLabel: t.hero.videoLabel, posterAlt: t.hero.posterAlt }} />

      <div className="home-flow">
        <div className="ambient-glow" aria-hidden="true" />

        {/* 3. Каталог — одразу після першого екрана, усі книжки відкрито */}
        {products.length > 0 && (
          <section id="catalog" aria-labelledby="catalog-title" className="relative isolate scroll-mt-20 pb-16 pt-16 sm:pb-24 sm:pt-24">
            <Decor items={DECOR.catalog} />
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 id="catalog-title" className={h2} data-reveal="left">{t.home.catalogTitle}</h2>
              <p className="mt-3 max-w-2xl text-lg text-ink-soft" data-reveal="right">{t.home.catalogLead}</p>
              <ul className={`mx-auto mt-10 grid gap-5 sm:gap-6 ${gridCols(products.length + 1)}`}>
                {products.map((p, i) => (
                  <li key={p.id} data-reveal="up" style={{ ["--reveal-delay" as string]: `${(i % 3) * 90}ms` }}>
                    <ProductCard p={p} lang={lang} t={t} />
                  </li>
                ))}
                <li data-reveal="up" style={{ ["--reveal-delay" as string]: `${(products.length % 3) * 90}ms` }}><ComingSoonCard text={t.home.soonCard} /></li>
              </ul>
            </div>
          </section>
        )}

        {/* 4. Атмосферний блок: текст ліворуч, фото книжок праворуч у фоні, розчиняється в молочному тлі */}
        <section aria-labelledby="books-atmo-title" className={`books-atmo relative isolate ${booksPhoto ? "books-atmo--photo" : ""}`}>
          <Decor items={DECOR.books} />
          {booksPhoto && (
            <div className="books-atmo__photo">
              <Picture base={booksPhoto.base} widths={booksPhoto.widths} width={booksPhoto.width} height={booksPhoto.height} alt={t.home.booksPhotoAlt}
                sizes="(min-width: 1024px) 62vw, 100vw" imgClassName="h-full w-full object-cover" />
            </div>
          )}
          <div className="books-atmo__text mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-xl">
              <p className={kicker} data-reveal="left">{t.home.booksKicker}</p>
              <h2 id="books-atmo-title" className={`mt-3 ${h2}`} data-reveal="left">{t.series.lead}</h2>
              <div className="prose-soft mt-6 text-ink-soft" data-reveal="right">
                <p>{t.series.paragraphs[3]}</p>
                <p>{t.series.paragraphs[5]}</p>
              </div>
              <ul className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {t.benefits.items.map((b, i) => (
                  <li key={b.title} className="benefit" data-reveal={i % 2 ? "right" : "left"} style={{ ["--reveal-delay" as string]: `${i * 70}ms`, ["--twinkle-delay" as string]: `${i * 0.7}s` }}>
                    <svg className="benefit__star" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
                      <path d="M12 2.5c.6 4.4 1.7 6.9 3.4 8.1 1.6 1.1 3.6 1.4 6.1 1.5-2.6.2-4.6.6-6.1 1.6-1.7 1.2-2.8 3.7-3.4 7.9-.6-4.2-1.7-6.7-3.4-7.9-1.5-1-3.5-1.4-6.1-1.6 2.5-.1 4.5-.4 6.1-1.5 1.7-1.2 2.8-3.7 3.4-8.1z" />
                    </svg>
                    <h3 className="text-xl text-plum-900">{b.title}</h3>
                    <p className="mt-1 text-[0.97rem] text-ink-soft">{b.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 5. Світ Лілі: наявні ілюстрації, мінімум тексту */}
        <section aria-labelledby="world-title" className="relative isolate py-16 sm:py-24">
          <Decor items={DECOR.world} />
          {/* великий заголовок розділу по центру */}
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 id="world-title" className="world-title" data-reveal="up">{t.home.worldKicker}</h2>
            <span className="world-title__flourish" aria-hidden="true" data-reveal="soft" />
          </div>
          <div className="mx-auto mt-8 grid max-w-6xl items-center gap-10 px-4 sm:mt-12 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
            <div className="lg:order-2">
              <h3 className="text-3xl text-plum-900 sm:text-4xl" data-reveal="right">{t.home.worldTitle}</h3>
              <p className="mt-4 max-w-[52ch] text-lg text-ink-soft" data-reveal="left">{t.home.worldText}</p>
              <p className="mt-6 border-l-2 border-gold pl-5 font-display text-2xl leading-snug text-plum-900" data-reveal="right">{t.series.closing}</p>
            </div>
            {/* ілюстрація в легкій шавлієвій хмаринці: краї кадру розчиняються в зелений градієнт, без жорстких меж */}
            <figure className="world-cloud relative lg:order-1" data-reveal="left">
              <span className="world-cloud__bg" aria-hidden="true"><i /><i /><i /><i /></span>
              <Picture base="/media/characters-lineup" widths={lu.widths} width={lu.width} height={lu.height} alt={t.series.lineupAlt}
                sizes="(min-width: 1024px) 520px, 92vw" className="world-cloud__img" imgClassName="h-auto w-full object-contain mix-blend-multiply" />
            </figure>
          </div>
        </section>

        {/* 6. Книжка зсередини — лише якщо є справжні розвороти */}
        {spreads.length > 0 && (
          <section aria-labelledby="inside-title" className="relative py-14 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <h2 id="inside-title" className={h2} data-reveal="left">{t.home.insideTitle}</h2>
              <Spreads items={spreads} hint={t.home.insideHint} close={t.home.close} />
            </div>
          </section>
        )}

        {/* 7. Про авторку */}
        <section id="about" aria-labelledby="author-title" className="relative isolate scroll-mt-20 py-16 sm:py-24">
          <Decor items={DECOR.author} />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            {authorPhoto ? (
              <figure data-reveal="left" className="author-frame mx-auto w-full max-w-[22rem] lg:max-w-none">
                <Picture base={authorPhoto.base} widths={authorPhoto.widths} width={authorPhoto.width} height={authorPhoto.height} alt={t.author.photoAlt}
                  sizes="(min-width: 1024px) 420px, 88vw" imgClassName="h-auto w-full object-cover" />
              </figure>
            ) : null}
            <div className={authorPhoto ? "" : "lg:col-span-2 lg:max-w-3xl"}>
              <p className={kicker} data-reveal="right">{t.author.kicker}</p>
              <h2 id="author-title" className={`mt-3 ${h2}`} data-reveal="right">{t.author.greeting}</h2>
              <div className="prose-soft mt-6 max-w-[62ch] text-ink-soft" data-reveal="left">
                {t.author.paragraphs.slice(0, 3).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <p className="mt-6 font-display text-2xl text-plum-900" data-reveal="right">{t.author.name}</p>
              <Link href={`/${lang}/about`} className="btn btn-ghost mt-6">{t.author.more}</Link>
            </div>
          </div>
        </section>

        {/* 8. Доставка, оплата, FAQ */}
        <section id="faq" aria-labelledby="delivery-title" className="relative isolate scroll-mt-20 py-16 sm:py-24">
          <Decor items={DECOR.faq} />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="delivery-title" className={h2} data-reveal="left">{t.home.deliveryTitle}</h2>
            <ul className="mt-8 grid gap-5 md:grid-cols-3">
              <li className="surface p-6 sm:p-7" data-reveal="left">
                <h3 className="text-2xl text-plum-900">{d.sections[0].h}</h3>
                <p className="mt-2 text-ink-soft">{pdfMode === "auto" ? t.faq.pdfAuto : t.faq.pdfManual}</p>
              </li>
              <li className="surface p-6 sm:p-7" data-reveal="up" style={{ ["--reveal-delay" as string]: "90ms" }}>
                <h3 className="text-2xl text-plum-900">{d.sections[1].h}</h3>
                <p className="mt-2 text-ink-soft">{t.faq.items[8].a[0]} {t.faq.items[8].a[1]}</p>
              </li>
              <li className="surface p-6 sm:p-7" data-reveal="right" style={{ ["--reveal-delay" as string]: "180ms" }}>
                <h3 className="text-2xl text-plum-900">{d.sections[3].h}</h3>
                <p className="mt-2 text-ink-soft">{payText} {t.faq.items[9].a[2]}</p>
              </li>
            </ul>
            <Link href={`/${lang}/delivery`} className="btn btn-ghost mt-8">{t.home.deliveryMore}</Link>

            <h2 id="faq-title" className={`mt-20 ${h2}`} data-reveal="right">{t.faq.title}</h2>
            <div className="mt-8 max-w-3xl"><Faq lang={lang} t={t} pdfMode={pdfMode} /></div>
          </div>
        </section>
      </div>
    </>
  );
}
