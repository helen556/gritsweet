import { sql, type Kysely } from "kysely";
import type { Database } from "./types";

/**
 * Ідемпотентна схема (SQLite і PostgreSQL). Гроші — цілі копійки (integer), без float.
 * Для Supabase додатково див. supabase/policies.sql (RLS, приватний bucket).
 */
/** Додає відсутні колонки (ідемпотентно; SQLite і PostgreSQL). */
async function addColumns(db: Kysely<Database>, table: string, cols: [string, "text" | "integer"][]) {
  const tables = await db.introspection.getTables();
  const existing = new Set(tables.find((x) => x.name === table)?.columns.map((c) => c.name) ?? []);
  for (const [name, type] of cols) {
    if (!existing.has(name)) await db.schema.alterTable(table).addColumn(name, type).execute();
  }
}

export async function migrate(db: Kysely<Database>) {
  const t = (name: string) => db.schema.createTable(name).ifNotExists();
  const now = sql`CURRENT_TIMESTAMP`;
  const idx = (name: string, table: string, cols: string[], unique = false) => {
    let b = db.schema.createIndex(name).ifNotExists().on(table).columns(cols);
    if (unique) b = b.unique();
    return b.execute();
  };

  await t("admin_users")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("email", "text", (c) => c.notNull().unique())
    .addColumn("password_hash", "text", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull().defaultTo("staff"))
    .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("session_version", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("products")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("slug", "text", (c) => c.notNull().unique())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("draft"))
    .addColumn("age_from", "integer")
    .addColumn("age_to", "integer")
    .addColumn("cover_base", "text")
    .addColumn("cover_widths", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("cover_width", "integer")
    .addColumn("cover_height", "integer")
    .addColumn("pages", "integer")
    .addColumn("size_label", "text")
    .addColumn("binding_label", "text")
    .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("product_translations")
    .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
    .addColumn("locale", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("cover_alt", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("is_confirmed", "integer", (c) => c.notNull().defaultTo(0))
    .addPrimaryKeyConstraint("product_translations_pk", ["product_id", "locale"])
    .execute();

  await t("product_variants")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
    .addColumn("book_locale", "text", (c) => c.notNull())
    .addColumn("format", "text", (c) => c.notNull())
    .addColumn("price_minor", "integer")
    .addColumn("currency", "text", (c) => c.notNull().defaultTo("UAH"))
    .addColumn("stock", "integer")
    .addColumn("private_pdf_key", "text")
    .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("restock_note", "text")
    .addColumn("updated_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();
  await idx("variants_unique", "product_variants", ["product_id", "book_locale", "format"], true);

  await t("orders")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("number", "text", (c) => c.notNull().unique())
    .addColumn("access_token_hash", "text", (c) => c.notNull().unique())
    .addColumn("idempotency_key", "text", (c) => c.notNull().unique())
    .addColumn("email", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("phone", "text")
    .addColumn("site_locale", "text", (c) => c.notNull())
    .addColumn("payment_status", "text", (c) => c.notNull())
    .addColumn("payment_mode", "text", (c) => c.notNull())
    .addColumn("payment_provider", "text")
    .addColumn("payment_reference", "text")
    .addColumn("total_minor", "integer", (c) => c.notNull())
    .addColumn("currency", "text", (c) => c.notNull())
    .addColumn("shipping_required", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("np_city", "text")
    .addColumn("np_city_ref", "text")
    .addColumn("np_point", "text")
    .addColumn("np_point_ref", "text")
    .addColumn("customer_note", "text")
    .addColumn("admin_note", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("paid_at", "text")
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("updated_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();
  await idx("orders_created", "orders", ["created_at"]);

  await t("order_items")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
    .addColumn("variant_id", "text", (c) => c.notNull())
    .addColumn("product_id", "text", (c) => c.notNull())
    .addColumn("title_snapshot", "text", (c) => c.notNull())
    .addColumn("book_locale", "text", (c) => c.notNull())
    .addColumn("format", "text", (c) => c.notNull())
    .addColumn("unit_price_minor", "integer", (c) => c.notNull())
    .addColumn("quantity", "integer", (c) => c.notNull())
    .addColumn("line_total_minor", "integer", (c) => c.notNull())
    .execute();
  await idx("order_items_order", "order_items", ["order_id"]);

  await t("payment_events")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("provider", "text", (c) => c.notNull())
    .addColumn("event_id", "text", (c) => c.notNull())
    .addColumn("order_id", "text")
    .addColumn("amount_minor", "integer")
    .addColumn("currency", "text")
    .addColumn("reported_status", "text", (c) => c.notNull())
    .addColumn("result", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();
  // ідемпотентність: одна подія провайдера обробляється один раз
  await idx("payment_events_unique", "payment_events", ["provider", "event_id"], true);

  await t("fulfillments")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("ttn", "text")
    .addColumn("updated_at", "text", (c) => c.notNull().defaultTo(now))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();
  await idx("fulfillments_unique", "fulfillments", ["order_id", "kind"], true);

  await t("download_grants")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
    .addColumn("order_item_id", "text", (c) => c.notNull())
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("expires_at", "text", (c) => c.notNull())
    .addColumn("max_downloads", "integer", (c) => c.notNull())
    .addColumn("download_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("revoked", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("email_deliveries")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("order_id", "text")
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("dedupe_key", "text", (c) => c.notNull().unique())
    .addColumn("to_email", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .addColumn("provider_message_id", "text")
    .addColumn("next_attempt_at", "text")
    .addColumn("sent_at", "text")
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("contact_messages")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("email", "text", (c) => c.notNull())
    .addColumn("order_number", "text")
    .addColumn("message", "text", (c) => c.notNull())
    .addColumn("site_locale", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("new"))
    .addColumn("admin_note", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  await t("settings")
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("value", "text", (c) => c.notNull())
    .execute();

  await t("audit_log")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("admin_id", "text")
    .addColumn("admin_email", "text")
    .addColumn("action", "text", (c) => c.notNull())
    .addColumn("entity", "text")
    .addColumn("entity_id", "text")
    .addColumn("details", "text")
    .addColumn("created_at", "text", (c) => c.notNull().defaultTo(now))
    .execute();

  // ---- v2 (CRM, квитанції, Telegram) ----
  await addColumns(db, "orders", [
    ["first_name", "text"], ["last_name", "text"],
    ["recipient_first_name", "text"], ["recipient_last_name", "text"], ["recipient_phone", "text"],
    ["sender_contact", "text"],
    ["order_status", "text"], // new | processing | completed | cancelled — окремо від оплати й доставки
    ["payment_method", "text"], ["payment_checked_by", "text"], ["payment_checked_at", "text"], ["provider_receipt_url", "text"],
    ["search_text", "text"], // нормалізований (lowercase у JS) текст для пошуку: SQLite lower() не знає кирилиці
  ]);
  await idx("orders_payment_status", "orders", ["payment_status"]);

  await t("order_events")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
    .addColumn("kind", "text", (c) => c.notNull()) // order | payment | digital | shipping | note | receipt
    .addColumn("from_status", "text")
    .addColumn("to_status", "text")
    .addColumn("actor", "text", (c) => c.notNull()) // email адміна / "покупець" / "система" / "провайдер:mono"
    .addColumn("details", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();
  await idx("order_events_order", "order_events", ["order_id", "created_at"]);

  await t("receipts")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
    .addColumn("storage_key", "text", (c) => c.notNull())
    .addColumn("content_type", "text", (c) => c.notNull())
    .addColumn("size_bytes", "integer", (c) => c.notNull())
    .addColumn("original_name", "text", (c) => c.notNull())
    .addColumn("uploaded_by", "text", (c) => c.notNull()) // "покупець" або email адміна
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await t("notifications")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("channel", "text", (c) => c.notNull()) // telegram
    .addColumn("dedupe_key", "text", (c) => c.notNull().unique())
    .addColumn("order_id", "text")
    .addColumn("payload", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull()) // queued | sent | failed | not_configured
    .addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .addColumn("next_attempt_at", "text")
    .addColumn("sent_at", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await t("rate_limits")
    .addColumn("key", "text", (c) => c.primaryKey())
    .addColumn("count", "integer", (c) => c.notNull())
    .addColumn("window_end", "text", (c) => c.notNull())
    .execute();
}
