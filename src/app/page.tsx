import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Catalog } from "@/components/Catalog";
import { Constructor } from "@/components/Constructor";
import { Reveal } from "@/components/Reveal";
import { About, Categories, Contacts, Flowers, MobileCta, ReviewsSection, Terms, WorksSection } from "@/components/Sections";
import { db } from "@/db";
import { getPublicCatalog } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, s, reviews] = await Promise.all([getPublicCatalog(), getSettings(),
    db.selectFrom("reviews").select(["id", "public_path", "alt", "width", "height"]).where("is_published", "=", 1).where("public_path", "is not", null).orderBy("sort_order").execute()]);
  const works = await db.selectFrom("photos").select(["id", "path", "alt", "width", "height"]).where("in_gallery", "=", 1).orderBy("sort_order").execute();
  const workItems = works.map((w) => ({ id: w.id, src: w.path, alt: w.alt, width: w.width ?? 4, height: w.height ?? 5 }));
  const reviewItems = reviews.map((r) => ({ id: r.id, src: r.public_path!, alt: r.alt, width: r.width, height: r.height }));
  let faq: { q: string; a: string }[] = [];
  try { faq = JSON.parse(s.faq || "[]"); } catch {}
  return (
    <>
      <Header />
      <main>
        <Hero title={s.hero_title} subtitle={s.hero_subtitle} />
        <Categories categories={categories} />
        <section id="kataloh" className="section-milk py-16 md:py-24" aria-labelledby="kat-h">
          <div className="wrap">
            <Reveal><h2 id="kat-h" className="text-4xl md:text-5xl">Каталог і ціни</h2>
              <p className="mt-3 max-w-prose text-muted">Ціни орієнтовні, без декору та доставки. Остаточну вартість підтверджує Дар’я після обговорення.</p></Reveal>
            <div className="mt-8"><Catalog categories={categories} /></div>
          </div>
        </section>
        <section id="zamovlennia" className="section-dark py-16 md:py-24 scroll-mt-16" aria-labelledby="ord-h">
          <div className="wrap">
            <Reveal className="mb-8 text-center"><h2 id="ord-h" className="text-4xl md:text-5xl">Зібрати свій торт</h2>
              <p className="mt-3 text-cream/75">Шість коротких кроків. Заявка — це побажання; деталі узгодимо особисто.</p></Reveal>
            <Constructor categories={categories} cupcakeMinBatch={s.cupcake_min_batch ?? ""} />
          </div>
        </section>
        <Flowers />
        <WorksSection items={workItems} instagram={s.instagram_url} />
        <About text={s.about_text} photo={s.about_photo} />
        <ReviewsSection items={reviewItems} instagram={s.instagram_url} />
        <Terms terms={s.order_terms} faq={faq} leadDays={s.lead_days} />
      </main>
      <Contacts phone={s.phone} instagram={s.instagram_url} city={s.city} />
      <MobileCta />
    </>
  );
}
