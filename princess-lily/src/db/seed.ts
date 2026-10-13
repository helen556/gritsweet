import type { Kysely } from "kysely";
import type { Database, Locale, BookFormat } from "./types";
import manifest from "../lib/media-manifest.json";
import extra from "../lib/media-extra.json";

/** Типові налаштування (лише якщо ще не задані): режим ручної оплати за наданим посиланням monobank. */
async function seedSettings(db: Kysely<Database>) {
  const defaults: [string, string][] = [
    ["payment_mode", "manual_link"],
    // Надане замовницею посилання. Тип посилання й передача суми НЕ підтверджені — сума не дописується в URL.
    ["payment_link_url", "https://send.monobank.ua/7ZH664WCkK"],
  ];
  for (const [key, value] of defaults) {
    const ex = await db.selectFrom("settings").select("key").where("key", "=", key).executeTakeFirst();
    if (!ex) await db.insertInto("settings").values({ key, value }).execute();
  }
}

type BookSeed = {
  id: string; slug: string; status: "draft" | "coming_soon"; sort: number;
  ukTitle: string; ukAlt: string;
  cover?: { base: string; key: keyof typeof manifest } | null;
};

/**
 * Три книжки серії, кожна у двох мовних версіях (UA/EN) і двох форматах (PDF/друк).
 * Ціни, описи, англійські назви та обкладинки нових книжок ще не надані — нічого не вигадуємо:
 *  - ціна null → «Незабаром», не продається; варіанти неактивні;
 *  - англійський переклад не підтверджено (is_confirmed=0) — на EN-сторінці показується оригінальна назва з позначкою;
 *  - книжки без обкладинки мають статус «чернетка» й не показуються на сайті, доки власниця не завантажить
 *    обкладинки в адмінці та не опублікує їх.
 * Сідування ідемпотентне: додає лише відсутні книжки й варіанти, не змінює відредаговане в адмінці.
 */
const BOOKS: BookSeed[] = [
  {
    id: "prd_bublik", slug: "yak-lili-vchyla-bublyka", status: "coming_soon", sort: 3,
    ukTitle: "Як Лілі вчила Бублика стригти кігтики",
    ukAlt: "Обкладинка книжки «Історії принцеси Лілі. Як Лілі вчила Бублика стригти кігтики»: Лілі, мама, тато й песик Бублик на ґанку",
    cover: { base: "/media/cover-bublik", key: "cover-bublik" },
  },
  { id: "prd_doctor", slug: "lili-ide-do-likarya", status: "draft", sort: 1, ukTitle: "Лілі йде до лікаря", ukAlt: "Обкладинка книжки «Лілі йде до лікаря»" },
  { id: "prd_potty", slug: "lili-yak-ya-navchylasya-sydity-na-horshchyk", status: "draft", sort: 2, ukTitle: "Лілі: як я навчилася сидіти на горщик", ukAlt: "Обкладинка книжки «Лілі: як я навчилася сидіти на горщик»" },
];

export async function seed(db: Kysely<Database>) {
  await seedSettings(db);
  await seedBooks(db);
  await applyPackagedMedia(db);
}

async function seedBooks(db: Kysely<Database>) {
  for (const b of BOOKS) {
    const exists = await db.selectFrom("products").select("id").where("id", "=", b.id).executeTakeFirst()
      ?? await db.selectFrom("products").select("id").where("slug", "=", b.slug).executeTakeFirst();
    const pid = exists?.id ?? b.id;
    if (!exists) {
      const c = b.cover ? (manifest as Record<string, { width: number; height: number; widths: number[] }>)[b.cover.key] : null;
      await db.insertInto("products").values({
        id: b.id, slug: b.slug, status: b.status, age_from: 2, age_to: 6,
        cover_base: b.cover?.base ?? null, cover_widths: JSON.stringify(c?.widths ?? []), cover_width: c?.width ?? null, cover_height: c?.height ?? null,
        pages: null, size_label: null, binding_label: null, sort_order: b.sort,
      }).execute();
      await db.insertInto("product_translations").values([
        { product_id: b.id, locale: "uk", is_confirmed: 1, title: b.ukTitle, description: "", cover_alt: b.ukAlt, cover_base: null, cover_widths: null, cover_width: null, cover_height: null },
        // англійська назва не надана — оригінальна назва з позначкою на сайті
        { product_id: b.id, locale: "en", is_confirmed: 0, title: b.ukTitle, description: "", cover_alt: `Cover of “${b.ukTitle}”, Princess Lily Stories`, cover_base: null, cover_widths: null, cover_width: null, cover_height: null },
      ]).execute();
    }
    for (const locale of ["uk", "en"] as Locale[]) for (const format of ["pdf", "print"] as BookFormat[]) {
      const has = await db.selectFrom("product_variants").select("id").where("product_id", "=", pid).where("book_locale", "=", locale).where("format", "=", format).executeTakeFirst();
      if (!has) await db.insertInto("product_variants").values({
        id: `var_${pid.replace(/^prd_/, "")}_${locale}_${format}`, product_id: pid, book_locale: locale, format,
        price_minor: null, stock: null, private_pdf_key: null, is_active: 0, restock_note: null,
      }).execute();
    }
  }
}

type ExtraImg = { base: string; width: number; height: number; widths: number[] };
type Extra = { covers: Record<string, Partial<Record<Locale, ExtraImg>>>; spreads: Record<string, (ExtraImg & { locale: Locale | null })[]> };

/**
 * Матеріали з assets-src (npm run assets:build → media-extra.json) підв'язуються до книжок за slug:
 *  - обкладинка мовної версії — лише якщо в адмінці ще не завантажено іншу;
 *  - книжка-чернетка, яка вперше отримала обкладинку, стає видимою зі статусом «Незабаром» (без ціни не продається);
 *  - розвороти — лише якщо в книжки ще немає жодного.
 */
export async function applyPackagedMedia(db: Kysely<Database>) {
  const ex = extra as unknown as Extra;
  for (const [slug, byLocale] of Object.entries(ex.covers ?? {})) {
    const p = await db.selectFrom("products").select(["id", "status", "cover_base"]).where("slug", "=", slug).executeTakeFirst();
    if (!p) { console.warn(`обкладинка для невідомої книжки: ${slug}`); continue; }
    const before = await db.selectFrom("product_translations").select("cover_base").where("product_id", "=", p.id).execute();
    const hadCover = !!p.cover_base || before.some((t) => t.cover_base);
    for (const [loc, c] of Object.entries(byLocale) as [Locale, ExtraImg][]) {
      await db.updateTable("product_translations").set({ cover_base: c.base, cover_widths: JSON.stringify(c.widths), cover_width: c.width, cover_height: c.height })
        .where("product_id", "=", p.id).where("locale", "=", loc).where("cover_base", "is", null).execute();
    }
    if (!hadCover && p.status === "draft") await db.updateTable("products").set({ status: "coming_soon" }).where("id", "=", p.id).execute();
  }
  for (const [slug, list] of Object.entries(ex.spreads ?? {})) {
    const p = await db.selectFrom("products").select("id").where("slug", "=", slug).executeTakeFirst();
    if (!p) continue;
    const has = await db.selectFrom("product_images").select("id").where("product_id", "=", p.id).executeTakeFirst();
    if (has) continue;
    let i = 0;
    for (const sp of list) await db.insertInto("product_images").values({
      id: `img_${slug.slice(0, 20)}_${++i}`, product_id: p.id, kind: "spread", locale: sp.locale, base: sp.base, widths: JSON.stringify(sp.widths),
      width: sp.width, height: sp.height, alt_uk: "Розворот книжки", alt_en: "Book spread", sort_order: i, created_at: new Date().toISOString(),
    }).execute();
  }
}
