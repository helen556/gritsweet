import { sql, type Kysely } from "kysely";
import type { Database } from "./types";

/** Створює таблиці, якщо їх немає. Працює і для SQLite, і для PostgreSQL. */
export async function migrate(db: Kysely<Database>) {
  const t = (name: string) => db.schema.createTable(name).ifNotExists();
  const now = sql`CURRENT_TIMESTAMP`;

  await t("admin_users")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("email", "text", (c) => c.notNull().unique())
    .addColumn("password_hash", "text", (c) => c.notNull())
    .addColumn("reset_token_hash", "text")
    .addColumn("reset_token_expiry", "text")
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("categories")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("slug", "text", (c) => c.notNull().unique())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("unit", "text", (c) => c.notNull())
    .addColumn("image_path", "text")
    .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("is_visible", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("is_archived", "integer", (c) => c.notNull().defaultTo(0))
    .execute();

  await t("products")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("category_id", "text", (c) => c.notNull().references("categories.id"))
    .addColumn("slug", "text", (c) => c.notNull().unique())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("image_path", "text")
    .addColumn("unit", "text", (c) => c.notNull())
    .addColumn("price_type", "text", (c) => c.notNull())
    .addColumn("price_min", "integer")
    .addColumn("price_max", "integer")
    .addColumn("min_qty", "integer")
    .addColumn("fillings", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("options", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("size_label", "text")
    .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("is_visible", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("is_archived", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("settings")
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("value", "text", (c) => c.notNull())
    .execute();

  await t("calendar_days")
    .addColumn("date", "text", (c) => c.primaryKey())
    .addColumn("is_closed", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("note", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("day_limit", "integer")
    .execute();

  await t("orders")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("status", "text", (c) => c.notNull().defaultTo("NEW"))
    .addColumn("customer_name", "text", (c) => c.notNull())
    .addColumn("phone", "text", (c) => c.notNull())
    .addColumn("desired_date", "text", (c) => c.notNull())
    .addColumn("delivery_type", "text", (c) => c.notNull())
    .addColumn("wishes", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("reference_path", "text")
    .addColumn("snapshot", "text", (c) => c.notNull())
    .addColumn("price_type", "text", (c) => c.notNull())
    .addColumn("estimated_min", "integer")
    .addColumn("estimated_max", "integer")
    .addColumn("final_price", "integer")
    .addColumn("admin_notes", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("idempotency_key", "text", (c) => c.notNull().unique())
    .execute();
  await db.schema.createIndex("orders_desired_date_idx").ifNotExists().on("orders").column("desired_date").execute();
  await db.schema.createIndex("orders_status_idx").ifNotExists().on("orders").column("status").execute();

  await t("order_events")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("payload", "text", (c) => c.notNull().defaultTo("{}"))
    .execute();

  await t("photos")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("path", "text", (c) => c.notNull())
    .addColumn("alt", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("in_gallery", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("width", "integer")
    .addColumn("height", "integer")
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();
  try { await db.schema.alterTable("products").addColumn("options", "text", (c) => c.notNull().defaultTo("[]")).execute(); } catch { /* вже є */ }
  // міграція старих баз без нових колонок
  for (const [col, type, def] of [["in_gallery", "integer", 0], ["sort_order", "integer", 0], ["width", "integer", null], ["height", "integer", null]] as const) {
    try { const q = db.schema.alterTable("photos").addColumn(col, type, (c) => (def === null ? c : c.notNull().defaultTo(def))); await q.execute(); } catch { /* вже є */ }
  }

  await t("reviews")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("private_path", "text", (c) => c.notNull())
    .addColumn("public_path", "text")
    .addColumn("alt", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("is_published", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("consent_checked", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("width", "integer", (c) => c.notNull())
    .addColumn("height", "integer", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("rate_limits")
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("window_end", "text", (c) => c.notNull())
    .execute();
}
