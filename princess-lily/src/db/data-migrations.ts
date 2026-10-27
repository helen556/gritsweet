import type { Kysely } from "kysely";
import type { Database } from "./types";
import { BOOK_CONTENT, OLD_DESCRIPTIONS, POTTY_SLUG } from "../content/books";
import { SERIES_SPECS } from "../lib/book-specs";

/**
 * Контрольовані data-міграції: кожна виконується в наявній базі рівно один раз (журнал data_migrations),
 * у транзакції. Замовлення та їхні знімки (order_items.title_snapshot) не змінюються — історія зберігається.
 */
type DataMigration = { id: string; run: (trx: Kysely<Database>) => Promise<void> };

const MIGRATIONS: DataMigration[] = [
  {
    // 27.10.2026: затверджені назви й alt-тексти, нова адреса книжки про горщик, 26 сторінок у характеристиках
    id: "2026-10-27-approved-titles",
    async run(trx) {
      const now = new Date().toISOString();
      for (const b of BOOK_CONTENT) {
        const p = await trx.selectFrom("products").select(["id", "slug", "pages"]).where("id", "=", b.id).executeTakeFirst();
        if (!p) continue;
        for (const locale of ["uk", "en"] as const) {
          const tr = await trx.selectFrom("product_translations").select("description").where("product_id", "=", b.id).where("locale", "=", locale).executeTakeFirst();
          if (!tr) continue;
          const old = OLD_DESCRIPTIONS[b.id]?.[locale] ?? [];
          const description = !tr.description.trim() || old.includes(tr.description) ? b[locale].description : tr.description;
          await trx.updateTable("product_translations").set({ title: b[locale].title, cover_alt: b[locale].alt, description })
            .where("product_id", "=", b.id).where("locale", "=", locale).execute();
        }
        const slug = b.id === "prd_potty" && p.slug !== POTTY_SLUG
          && !(await trx.selectFrom("products").select("id").where("slug", "=", POTTY_SLUG).executeTakeFirst()) ? POTTY_SLUG : p.slug;
        if (slug !== p.slug) await rememberSlug(trx, p.slug, p.id);
        await trx.updateTable("products").set({ slug, pages: p.pages ?? SERIES_SPECS.pages, updated_at: now }).where("id", "=", p.id).execute();
      }
    },
  },
];

/** Стара адреса книжки → товар (сторінка за старою адресою постійно переадресовує на нову). */
export async function rememberSlug(db: Kysely<Database>, oldSlug: string, productId: string) {
  await db.insertInto("slug_redirects").values({ old_slug: oldSlug, product_id: productId, created_at: new Date().toISOString() })
    .onConflict((oc) => oc.column("old_slug").doUpdateSet({ product_id: productId })).execute();
}

export async function runDataMigrations(db: Kysely<Database>) {
  for (const m of MIGRATIONS) {
    const done = await db.selectFrom("data_migrations").select("id").where("id", "=", m.id).executeTakeFirst();
    if (done) continue;
    await db.transaction().execute(async (trx) => {
      await m.run(trx);
      await trx.insertInto("data_migrations").values({ id: m.id, applied_at: new Date().toISOString() }).execute();
    });
    console.log(`data-міграцію застосовано: ${m.id}`);
  }
}
