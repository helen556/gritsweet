import type { Kysely } from "kysely";
import type { Database } from "./types";
import manifest from "../lib/media-manifest.json";

/**
 * Початкові дані: ОДНА чернетка товару з наданою обкладинкою.
 * Ціни немає (null) → «Незабаром», не продається. Англійського видання цієї книжки
 * не підтверджено, тому створено лише українські варіанти (PDF і друк), обидва неактивні.
 * Опис конкретної книжки не надано — поле порожнє, не вигадуємо.
 */
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

export async function seed(db: Kysely<Database>) {
  await seedSettings(db);
  const exists = await db.selectFrom("products").select("id").where("slug", "=", "yak-lili-vchyla-bublyka").executeTakeFirst();
  if (exists) return;
  const c = manifest["cover-bublik"];
  await db.insertInto("products").values({
    id: "prd_bublik",
    slug: "yak-lili-vchyla-bublyka",
    status: "coming_soon",
    age_from: 2,
    age_to: 6,
    cover_base: "/media/cover-bublik",
    cover_widths: JSON.stringify(c.widths),
    cover_width: c.width,
    cover_height: c.height,
    pages: null,
    size_label: null,
    binding_label: null,
    sort_order: 1,
  }).execute();
  await db.insertInto("product_translations").values([
    {
      product_id: "prd_bublik", locale: "uk", is_confirmed: 1,
      title: "Як Лілі вчила Бублика стригти кігтики",
      description: "",
      cover_alt: "Обкладинка книжки «Історії принцеси Лілі. Як Лілі вчила Бублика стригти кігтики»: Лілі, мама, тато й песик Бублик на ґанку",
    },
    {
      // Англійська назва не надана: показуємо оригінальну українську з позначкою.
      product_id: "prd_bublik", locale: "en", is_confirmed: 0,
      title: "Як Лілі вчила Бублика стригти кігтики",
      description: "",
      cover_alt: "Cover of the Ukrainian edition of a Princess Lily Stories book: Lily, her mom and dad, and Bublik the puppy on a porch",
    },
  ]).execute();
  await db.insertInto("product_variants").values([
    { id: "var_bublik_uk_pdf", product_id: "prd_bublik", book_locale: "uk", format: "pdf", price_minor: null, stock: null, private_pdf_key: null, is_active: 0, restock_note: null },
    { id: "var_bublik_uk_print", product_id: "prd_bublik", book_locale: "uk", format: "print", price_minor: null, stock: null, private_pdf_key: null, is_active: 0, restock_note: null },
  ]).execute();
}
