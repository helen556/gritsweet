import type { Kysely } from "kysely";
import type { Database, Locale, BookFormat } from "./types";
import manifest from "../lib/media-manifest.json";
import extra from "../lib/media-extra.json";
import { BOOK_CONTENT, POTTY_SLUG } from "../content/books";
import { SERIES_SPECS } from "../lib/book-specs";
import { runDataMigrations } from "./data-migrations";

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
  id: string; slug: string; sort: number;
  cover?: { base: string; key: keyof typeof manifest } | null;
  /** Ціни в копійках, якщо відрізняються від типових (комплект). */
  pricePdf?: number; pricePrint?: number;
};

/**
 * Книжки серії та комплект, кожна у двох мовних версіях (UA/EN) і двох форматах (PDF/друк).
 * Назви, alt-тексти й описи — у src/content/books.ts (точно як на обкладинках).
 * Ціни від власниці (13.10.2026): друкована 399 грн, PDF 299 грн, в наявності.
 * PDF продається лише після завантаження файлу в адмінці (без файлу покупець нічого б не отримав).
 * Залишок друку 100 — стартове значення, власниця змінює його в адмінці.
 * Сідування ідемпотентне: додає лише відсутні книжки й варіанти, не змінює відредаговане в адмінці.
 */
const PRICE_PRINT = 39900, PRICE_PDF = 29900, START_STOCK = 100;
const BOOKS: BookSeed[] = [
  { id: "prd_doctor", slug: "lili-ide-do-likarya", sort: 1 },
  { id: "prd_potty", slug: POTTY_SLUG, sort: 2 },
  { id: "prd_bublik", slug: "yak-lili-vchyla-bublyka", sort: 3, cover: { base: "/media/cover-bublik", key: "cover-bublik" } },
  { id: "prd_friend", slug: "lili-vchytsya-druzhyty", sort: 4 },
  { id: "prd_sleep", slug: "lili-ta-kazka-pro-son", sort: 5 },
  // Комплект — окремий товар (ціни від власниці 15.10.2026): PDF 1395 грн, друкований 1895 грн
  { id: "prd_set5", slug: "komplekt-5-knyzhok", sort: 6, pricePdf: 139500, pricePrint: 189500 },
];

export async function seed(db: Kysely<Database>) {
  await seedSettings(db);
  await seedBooks(db);
  await runDataMigrations(db);
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
        id: b.id, slug: b.slug, status: "published", age_from: 2, age_to: 6,
        cover_base: b.cover?.base ?? null, cover_widths: JSON.stringify(c?.widths ?? []), cover_width: c?.width ?? null, cover_height: c?.height ?? null,
        pages: SERIES_SPECS.pages, size_label: null, binding_label: null, sort_order: b.sort,
      }).execute();
      const copy = BOOK_CONTENT.find((x) => x.id === b.id)!;
      await db.insertInto("product_translations").values((["uk", "en"] as const).map((locale) => ({
        product_id: b.id, locale, is_confirmed: 1, title: copy[locale].title, description: copy[locale].description, cover_alt: copy[locale].alt,
        cover_base: null, cover_widths: null, cover_width: null, cover_height: null,
      }))).execute();
    }
    for (const locale of ["uk", "en"] as Locale[]) for (const format of ["pdf", "print"] as BookFormat[]) {
      const has = await db.selectFrom("product_variants").select("id").where("product_id", "=", pid).where("book_locale", "=", locale).where("format", "=", format).executeTakeFirst();
      if (!has) await db.insertInto("product_variants").values({
        id: `var_${pid.replace(/^prd_/, "")}_${locale}_${format}`, product_id: pid, book_locale: locale, format,
        price_minor: format === "pdf" ? (b.pricePdf ?? PRICE_PDF) : (b.pricePrint ?? PRICE_PRINT), stock: format === "print" ? START_STOCK : null, private_pdf_key: null, is_active: 1, restock_note: null,
      }).execute();
    }
  }
}

type ExtraImg = { base: string; width: number; height: number; widths: number[] };
type Extra = { covers: Record<string, Partial<Record<Locale, ExtraImg>>>; spreads: Record<string, (ExtraImg & { locale: Locale | null })[]> };

/**
 * Матеріали з assets-src (npm run assets:build → media-extra.json) підв'язуються до книжок за slug:
 *  - обкладинка мовної версії — якщо в адмінці не завантажено іншу (/uploads/…): порожню або попередню
 *    обкладинку з пакета (/media/cover-…) замінює актуальна — так нова версія обкладинки доходить до наявної бази;
 *  - книжка-чернетка, яка вперше отримала обкладинку, стає видимою зі статусом «Незабаром»;
 *  - розвороти — лише якщо в книжки ще немає жодного.
 */
/** Книжка за slug, а для книжок серії — ще й за id (у старих базах адреси могли бути записані інакше). */
async function findBook<K extends "id" | "status" | "cover_base">(db: Kysely<Database>, slug: string, cols: K[]) {
  const bySlug = await db.selectFrom("products").select(cols).where("slug", "=", slug).executeTakeFirst();
  if (bySlug) return bySlug;
  const id = BOOKS.find((b) => b.slug === slug)?.id;
  return id ? db.selectFrom("products").select(cols).where("id", "=", id).executeTakeFirst() : undefined;
}

export async function applyPackagedMedia(db: Kysely<Database>) {
  const ex = extra as unknown as Extra;
  for (const [slug, byLocale] of Object.entries(ex.covers ?? {})) {
    const p = await findBook(db, slug, ["id", "status", "cover_base"]);
    if (!p) { console.warn(`обкладинка для невідомої книжки: ${slug}`); continue; }
    const before = await db.selectFrom("product_translations").select("cover_base").where("product_id", "=", p.id).execute();
    const hadCover = !!p.cover_base || before.some((t) => t.cover_base);
    for (const [loc, c] of Object.entries(byLocale) as [Locale, ExtraImg][]) {
      await db.updateTable("product_translations").set({ cover_base: c.base, cover_widths: JSON.stringify(c.widths), cover_width: c.width, cover_height: c.height })
        .where("product_id", "=", p.id).where("locale", "=", loc)
        .where((eb) => eb.or([eb("cover_base", "is", null), eb.and([eb("cover_base", "like", "/media/cover-%"), eb("cover_base", "!=", c.base)])]))
        .execute();
    }
    if (!hadCover && p.status === "draft") await db.updateTable("products").set({ status: "coming_soon" }).where("id", "=", p.id).execute();
  }
  for (const [slug, list] of Object.entries(ex.spreads ?? {})) {
    const p = await findBook(db, slug, ["id"]);
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
