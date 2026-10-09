import "server-only";
import { db } from "@/db";
import type { Locale, PaymentStatus } from "@/db/types";
import { quoteCart, type CartLineInput } from "./quote";
import { newId, newToken, sha256 } from "./ids";
import { paymentConfig, PAYMENT_MODES } from "./config";
import { adapterById } from "./payments/providers";
import { logOrderEvent } from "./events";
import { getSettings } from "./settings";

export type CheckoutInput = {
  lines: CartLineInput[];
  email: string; firstName: string; lastName: string; phone: string | null;
  /** Одержувач — лише якщо інша людина (для друкованих замовлень) */
  recipient?: { firstName: string; lastName: string; phone: string } | null;
  npCity: string | null; npCityRef: string | null; npPoint: string | null; npPointRef: string | null;
  note: string | null; siteLocale: Locale; idempotencyKey: string;
};
export type CreateOrderResult =
  | { ok: true; orderId: string; accessToken: string | null; duplicate: boolean }
  | { ok: false; error: "empty" | "unavailable" | "shipping_required" | "payment_unavailable" | "changed" };

/** Обраний режим: налаштування адмінки (payment_mode), інакше змінна PAYMENT_MODE. */
export async function configuredPaymentMode() {
  const s = await getSettings();
  const cfg = paymentConfig();
  const fromAdmin = PAYMENT_MODES.includes(s.payment_mode as never) ? (s.payment_mode as typeof cfg.mode) : "";
  return fromAdmin || cfg.envMode || "disabled";
}

/**
 * Режим оплати, що РЕАЛЬНО діє зараз:
 *   manual_link    — лише якщо задано платіжне посилання;
 *   mono_acquiring — лише якщо є MONOBANK_TOKEN (інакше вимкнено, а не «вдаємо, що працює»);
 *   provider       — тестовий провайдер, лише поза production.
 */
export async function effectivePaymentMode(): Promise<"disabled" | "manual_link" | "provider"> {
  const mode = await configuredPaymentMode();
  const cfg = paymentConfig();
  if (mode === "manual_link") return (await getSettings()).payment_link_url ? "manual_link" : "disabled";
  if (mode === "mono_acquiring") return cfg.monoToken ? "provider" : "disabled";
  if (mode === "provider") return cfg.testReady ? "provider" : "disabled";
  return "disabled";
}
export async function activePaymentAdapter() {
  const mode = await configuredPaymentMode();
  if (mode === "mono_acquiring") return adapterById("mono");
  if (mode === "provider") return adapterById("test");
  return null;
}

async function nextOrderNumber() {
  const yy = String(new Date().getUTCFullYear()).slice(2);
  for (let i = 0; i < 5; i++) {
    const n = `PL-${yy}${String(Math.floor(100000 + Math.random() * 900000))}`;
    if (!(await db.selectFrom("orders").select("id").where("number", "=", n).executeTakeFirst())) return n;
  }
  return `PL-${yy}${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Створює замовлення ДО переходу на оплату. Суми — лише з серверного розрахунку.
 * `expectedTotalMinor` (те, що бачив покупець) лише для виявлення змін ціни, не для оплати.
 */
export async function createOrder(input: CheckoutInput, expectedTotalMinor?: number): Promise<CreateOrderResult> {
  const mode = await effectivePaymentMode();
  if (mode === "disabled") return { ok: false, error: "payment_unavailable" };

  const dup = await db.selectFrom("orders").select("id").where("idempotency_key", "=", input.idempotencyKey).executeTakeFirst();
  if (dup) return { ok: true, orderId: dup.id, accessToken: null, duplicate: true };

  const q = await quoteCart(input.lines, input.siteLocale);
  if (!q.lines.length) return { ok: false, error: q.unavailable.length ? "unavailable" : "empty" };
  if (q.unavailable.length) return { ok: false, error: "unavailable" };
  if (expectedTotalMinor != null && expectedTotalMinor !== q.totalMinor) return { ok: false, error: "changed" };
  if (q.shippingRequired && (!input.npCity || !input.npPoint || !input.phone)) return { ok: false, error: "shipping_required" };

  const orderId = newId("ord");
  const token = newToken();
  const number = await nextOrderNumber();
  const hasPdf = q.lines.some((l) => l.format === "pdf");
  // усе, що читає БД, — ДО транзакції (SQLite: одне з'єднання)
  const adapterId = mode === "provider" ? (await activePaymentAdapter())?.id ?? null : null;
  await db.transaction().execute(async (trx) => {
    await trx.insertInto("orders").values({
      id: orderId, number, access_token_hash: sha256(token), idempotency_key: input.idempotencyKey,
      email: input.email, name: `${input.firstName} ${input.lastName}`.trim(), first_name: input.firstName, last_name: input.lastName,
      phone: input.phone, site_locale: input.siteLocale,
      recipient_first_name: q.shippingRequired ? input.recipient?.firstName ?? null : null,
      recipient_last_name: q.shippingRequired ? input.recipient?.lastName ?? null : null,
      recipient_phone: q.shippingRequired ? input.recipient?.phone ?? null : null,
      search_text: [number, input.firstName, input.lastName, input.email, input.phone?.replace(/\D/g, ""), input.recipient?.firstName, input.recipient?.lastName, input.recipient?.phone?.replace(/\D/g, "")]
        .filter(Boolean).join(" ").toLowerCase(),
      order_status: "new", payment_method: mode === "manual_link" ? "manual_link" : adapterId,
      payment_status: "pending_payment", payment_mode: mode, payment_provider: adapterId,
      payment_reference: null, total_minor: q.totalMinor, currency: q.currency,
      shipping_required: q.shippingRequired ? 1 : 0,
      np_city: q.shippingRequired ? input.npCity : null, np_city_ref: q.shippingRequired ? input.npCityRef : null,
      np_point: q.shippingRequired ? input.npPoint : null, np_point_ref: q.shippingRequired ? input.npPointRef : null,
      customer_note: input.note, paid_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).execute();
    await trx.insertInto("order_items").values(q.lines.map((l) => ({
      id: newId("itm"), order_id: orderId, variant_id: l.variantId, product_id: l.productId, title_snapshot: l.title,
      book_locale: l.bookLocale, format: l.format, unit_price_minor: l.unitPriceMinor, quantity: l.quantity, line_total_minor: l.lineTotalMinor,
    }))).execute();
    if (hasPdf) await trx.insertInto("fulfillments").values({ id: newId("ful"), order_id: orderId, kind: "digital", status: "awaiting_payment", ttn: null }).execute();
    if (q.shippingRequired) await trx.insertInto("fulfillments").values({ id: newId("ful"), order_id: orderId, kind: "shipping", status: "awaiting_payment", ttn: null }).execute();
  });
  await logOrderEvent(orderId, "order", null, "new", "покупець", `Замовлення створено (${mode})`);
  await logOrderEvent(orderId, "payment", null, "pending_payment", "система");
  return { ok: true, orderId, accessToken: token, duplicate: false };
}

export async function orderByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  return db.selectFrom("orders").selectAll().where("access_token_hash", "=", sha256(token)).executeTakeFirst() ?? null;
}
export async function orderDetails(orderId: string) {
  const [order, items, fulfillments] = await Promise.all([
    db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst(),
    db.selectFrom("order_items").selectAll().where("order_id", "=", orderId).execute(),
    db.selectFrom("fulfillments").selectAll().where("order_id", "=", orderId).execute(),
  ]);
  return order ? { order, items, digital: fulfillments.find((f) => f.kind === "digital") ?? null, shipping: fulfillments.find((f) => f.kind === "shipping") ?? null } : null;
}

/** Покупець у manual-режимі натиснув «Я оплатив(ла)»: лише позначка для перевірки, без видачі. */
export async function customerClaimsPaid(orderId: string) {
  const r = await db.updateTable("orders").set({ payment_status: "pending_verification" satisfies PaymentStatus, updated_at: new Date().toISOString() })
    .where("id", "=", orderId).where("payment_status", "=", "pending_payment").where("payment_mode", "=", "manual_link").executeTakeFirst();
  if (Number(r.numUpdatedRows) === 1) await logOrderEvent(orderId, "payment", "pending_payment", "pending_verification", "покупець", "Позначка «Я оплатив(ла)» — потрібна перевірка");
}
