import type { Generated, Selectable } from "kysely";

export type Locale = "uk" | "en";
export type BookFormat = "pdf" | "print";
export type ProductStatus = "draft" | "coming_soon" | "published";
/** Статус оплати — окремо від статусу доставки/видачі. */
export type PaymentStatus = "pending_payment" | "pending_verification" | "paid" | "failed" | "cancelled";
export type FulfillmentKind = "digital" | "shipping";
export type DigitalStatus = "awaiting_payment" | "ready" | "sent" | "email_failed" | "email_not_configured";
export type ShippingStatus = "awaiting_payment" | "to_ship" | "shipped" | "delivered" | "cancelled";

export interface AdminUsersTable {
  id: string;
  email: string;
  password_hash: string;
  role: "owner" | "staff";
  is_active: Generated<number>;
  session_version: Generated<number>;
  created_at: Generated<string>;
}
export interface ProductsTable {
  id: string;
  slug: string;
  status: ProductStatus;
  age_from: number | null;
  age_to: number | null;
  /** База шляху до набору зображень, напр. "/media/cover-bublik" → /media/cover-bublik-640.avif */
  cover_base: string | null;
  cover_widths: string; // JSON number[]
  cover_width: number | null;
  cover_height: number | null;
  /** Параметри видання — лише коли надані власницею. */
  pages: number | null;
  size_label: string | null;
  binding_label: string | null;
  sort_order: Generated<number>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}
export interface ProductTranslationsTable {
  product_id: string;
  locale: Locale;
  title: string;
  description: string;
  cover_alt: string;
  /** 1 — переклад погоджено; 0 — показуємо з позначкою «переклад готується». */
  is_confirmed: Generated<number>;
}
export interface ProductVariantsTable {
  id: string;
  product_id: string;
  book_locale: Locale;
  format: BookFormat;
  /** Ціна в копійках. null = ціна ще не встановлена → не продається. */
  price_minor: number | null;
  currency: Generated<string>;
  /** Залишок для друку; для PDF не використовується. */
  stock: number | null;
  private_pdf_key: string | null;
  is_active: Generated<number>;
  restock_note: string | null;
  updated_at: Generated<string>;
}
export interface OrdersTable {
  id: string;
  number: string;
  access_token_hash: string;
  idempotency_key: string;
  email: string;
  name: string;
  phone: string | null;
  site_locale: Locale;
  payment_status: PaymentStatus;
  payment_mode: string;
  payment_provider: string | null;
  payment_reference: string | null;
  total_minor: number;
  currency: string;
  shipping_required: number;
  np_city: string | null;
  np_city_ref: string | null;
  np_point: string | null;
  np_point_ref: string | null;
  customer_note: string | null;
  admin_note: Generated<string>;
  paid_at: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}
export interface OrderItemsTable {
  id: string;
  order_id: string;
  variant_id: string;
  product_id: string;
  /** Знімок даних на момент купівлі — зміни каталогу їх не торкаються. */
  title_snapshot: string;
  book_locale: Locale;
  format: BookFormat;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
}
export interface PaymentEventsTable {
  id: string;
  provider: string;
  event_id: string;
  order_id: string | null;
  amount_minor: number | null;
  currency: string | null;
  reported_status: string;
  result: string;
  created_at: Generated<string>;
}
export interface FulfillmentsTable {
  id: string;
  order_id: string;
  kind: FulfillmentKind;
  status: string;
  ttn: string | null;
  updated_at: Generated<string>;
  created_at: Generated<string>;
}
export interface DownloadGrantsTable {
  id: string;
  order_id: string;
  order_item_id: string;
  token_hash: string;
  expires_at: string;
  max_downloads: number;
  download_count: Generated<number>;
  revoked: Generated<number>;
  created_at: Generated<string>;
}
export interface EmailDeliveriesTable {
  id: string;
  order_id: string | null;
  kind: string;
  dedupe_key: string;
  to_email: string;
  status: "queued" | "sent" | "failed" | "not_configured";
  attempts: Generated<number>;
  last_error: string | null;
  provider_message_id: string | null;
  next_attempt_at: string | null;
  sent_at: string | null;
  created_at: Generated<string>;
}
export interface ContactMessagesTable {
  id: string;
  name: string;
  email: string;
  order_number: string | null;
  message: string;
  site_locale: Locale;
  status: "new" | "in_progress" | "closed";
  admin_note: Generated<string>;
  created_at: Generated<string>;
}
export interface SettingsTable { key: string; value: string }
export interface AuditLogTable {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: string | null;
  created_at: Generated<string>;
}
export interface RateLimitsTable { key: string; count: number; window_end: string }

export interface Database {
  admin_users: AdminUsersTable;
  products: ProductsTable;
  product_translations: ProductTranslationsTable;
  product_variants: ProductVariantsTable;
  orders: OrdersTable;
  order_items: OrderItemsTable;
  payment_events: PaymentEventsTable;
  fulfillments: FulfillmentsTable;
  download_grants: DownloadGrantsTable;
  email_deliveries: EmailDeliveriesTable;
  contact_messages: ContactMessagesTable;
  settings: SettingsTable;
  audit_log: AuditLogTable;
  rate_limits: RateLimitsTable;
}

export type Product = Selectable<ProductsTable>;
export type ProductVariant = Selectable<ProductVariantsTable>;
export type Order = Selectable<OrdersTable>;
export type OrderItem = Selectable<OrderItemsTable>;
