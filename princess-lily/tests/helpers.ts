import { db } from "@/db";
import { migrate } from "@/db/migrate";
import { seed } from "@/db/seed";
import { sql } from "kysely";

/** Тестові фікстури — ЛИШЕ в тестах (in-memory SQLite). Позначені [TEST]. */
export async function resetDb() {
  const tables = ["order_events", "receipts", "notifications", "download_grants", "email_deliveries", "payment_events", "fulfillments", "order_items", "orders", "product_variants", "product_translations", "products", "contact_messages", "settings", "audit_log", "rate_limits", "admin_users"];
  await migrate(db);
  for (const t of tables) await sql`DELETE FROM ${sql.table(t)}`.execute(db);
  await seed(db);
  // типові налаштування з seed (manual_link) прибираємо — тести керують режимом через env
  await sql`DELETE FROM settings`.execute(db);
  await db.insertInto("products").values({ id: "prd_test", slug: "test-book", status: "published", age_from: 2, age_to: 6, cover_base: null, cover_widths: "[]", cover_width: null, cover_height: null, pages: null, size_label: null, binding_label: null }).execute();
  await db.insertInto("product_translations").values([{ product_id: "prd_test", locale: "uk", title: "[TEST] Тестова книжка", description: "", cover_alt: "", is_confirmed: 1 }]).execute();
  await db.insertInto("product_variants").values([
    { id: "v_pdf", product_id: "prd_test", book_locale: "uk", format: "pdf", price_minor: 25000, stock: null, private_pdf_key: "pdf/test.pdf", is_active: 1, restock_note: null },
    { id: "v_print", product_id: "prd_test", book_locale: "uk", format: "print", price_minor: 45050, stock: 3, private_pdf_key: null, is_active: 1, restock_note: null },
  ]).execute();
}
export const baseCheckout = (over: Record<string, unknown> = {}) => ({
  lines: [{ variantId: "v_pdf", quantity: 1 }],
  email: "parent@example.com", firstName: "Олена", lastName: "Тестова", phone: null, npCity: null, npCityRef: null, npPoint: null, npPointRef: null,
  note: null, siteLocale: "uk" as const, idempotencyKey: `idem-${Math.random()}`, ...over,
});
