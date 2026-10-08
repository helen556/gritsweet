import "dotenv/config";
import { db } from "../src/db";
import { migrate } from "../src/db/migrate";
import { seed } from "../src/db/seed";
import { privateStorage } from "../src/lib/storage";

/**
 * ДЕМО-ФІКСТУРИ — лише для локальної перевірки покупки. Позначені «[DEMO]».
 * Відмовляється працювати в production або з PostgreSQL. Використовуйте окрему БД:
 *   DATABASE_URL=file:./data/demo.db npm run demo:fixtures
 */
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" || url.startsWith("postgres") || !url.includes("demo")) {
    throw new Error("Демо-фікстури дозволені лише для локальної БД з 'demo' у назві (DATABASE_URL=file:./data/demo.db)");
  }
  await migrate(db);
  await seed(db);
  if (await db.selectFrom("products").select("id").where("id", "=", "prd_demo").executeTakeFirst()) { console.log("Вже є"); return db.destroy(); }
  await db.insertInto("products").values({ id: "prd_demo", slug: "demo-book", status: "published", age_from: 2, age_to: 6, cover_base: "/media/cover-bublik", cover_widths: "[360,640,960,1254]", cover_width: 1254, cover_height: 1254, pages: null, size_label: null, binding_label: null, sort_order: 99 }).execute();
  await db.insertInto("product_translations").values([
    { product_id: "prd_demo", locale: "uk", title: "[DEMO] Тестова книжка (не для продажу)", description: "Демонстраційний товар для перевірки кошика й оформлення. Не існує в production.", cover_alt: "Демо", is_confirmed: 1 },
    { product_id: "prd_demo", locale: "en", title: "[DEMO] Test book (not for sale)", description: "Demo item to test cart and checkout. Never present in production.", cover_alt: "Demo", is_confirmed: 1 },
  ]).execute();
  // мінімальний валідний PDF
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  await privateStorage().put("pdf/demo-uk.pdf", pdf, "application/pdf");
  await db.insertInto("product_variants").values([
    { id: "var_demo_uk_pdf", product_id: "prd_demo", book_locale: "uk", format: "pdf", price_minor: 19900, stock: null, private_pdf_key: "pdf/demo-uk.pdf", is_active: 1, restock_note: null },
    { id: "var_demo_uk_print", product_id: "prd_demo", book_locale: "uk", format: "print", price_minor: 38050, stock: 5, private_pdf_key: null, is_active: 1, restock_note: null },
    { id: "var_demo_en_pdf", product_id: "prd_demo", book_locale: "en", format: "pdf", price_minor: 19900, stock: null, private_pdf_key: null, is_active: 1, restock_note: null },
  ]).execute();
  console.log("[DEMO] фікстури створено");
  await db.destroy();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
