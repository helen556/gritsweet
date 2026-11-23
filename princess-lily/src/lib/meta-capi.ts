import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { appUrl } from "./config";
import { metaCapiConfigured, metaPixelId } from "./tracking";
import { logOrderEvent } from "./events";

/**
 * Meta Conversions API: серверна подія Purchase — лише після підтвердженої оплати (markPaid) і лише якщо покупець
 * дав згоду на рекламні cookie під час оформлення. event_id збігається з браузерною подією («purchase-<id>»),
 * тож Meta рахує одну покупку навіть коли надійшли обидві. Токен — лише серверна змінна META_CAPI_ACCESS_TOKEN.
 */
const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export const purchaseEventId = (orderId: string) => `purchase-${orderId}`;

/** Сума покупки для Meta: фактична підсумкова сума замовлення в гривнях (з копійок), лише додатне число. */
export const purchaseValue = (totalMinor: number) => (Number.isFinite(totalMinor) && totalMinor > 0 ? Math.round(totalMinor) / 100 : null);
export const PURCHASE_CURRENCY = "UAH" as const;

type CapiOrder = { id: string; number: string; total_minor: number; email: string; phone: string | null; first_name: string | null; last_name: string | null;
  meta_fbp: string | null; meta_fbc: string | null; meta_ua?: string | null; np_city?: string | null; paid_at: string | null; site_locale: string };

/** Місто для Meta: нижній регістр, без «м.», пробілів і розділових знаків (як вимагає Meta перед хешуванням). */
export const normCity = (c: string) => c.toLowerCase().replace(/^(м\.|смт\.?|с\.)\s*/u, "").split(",")[0].replace(/[\s\p{P}\p{S}]+/gu, "");
type CapiItem = { product_id: string; quantity: number; unit_price_minor: number };

/** Серверна подія Purchase (Conversions API) — ті самі value, currency та event_id, що й у браузерного пікселя. */
export function purchaseCapiEvent(o: CapiOrder, items: CapiItem[], siteUrl: string) {
  const value = purchaseValue(o.total_minor);
  if (value == null) return null;
  const phone = (o.phone ?? "").replace(/\D/g, "");
  return {
    event_name: "Purchase",
    event_time: Math.floor(Date.parse(o.paid_at ?? new Date().toISOString()) / 1000),
    event_id: purchaseEventId(o.id),
    action_source: "website",
    event_source_url: `${siteUrl}/${o.site_locale}/checkout`,
    user_data: {
      em: [sha(o.email)],
      ...(phone ? { ph: [sha(phone)] } : {}),
      ...(o.first_name ? { fn: [sha(o.first_name)] } : {}),
      ...(o.last_name ? { ln: [sha(o.last_name)] } : {}),
      country: [sha("ua")],
      ...(o.np_city && normCity(o.np_city) ? { ct: [sha(normCity(o.np_city))] } : {}),
      ...(o.meta_ua ? { client_user_agent: o.meta_ua } : {}),
      ...(o.meta_fbp ? { fbp: o.meta_fbp } : {}),
      ...(o.meta_fbc ? { fbc: o.meta_fbc } : {}),
    },
    custom_data: {
      value, currency: PURCHASE_CURRENCY, order_id: o.number, content_type: "product",
      content_ids: [...new Set(items.map((i) => i.product_id))],
      contents: items.map((i) => ({ id: i.product_id, quantity: i.quantity, item_price: i.unit_price_minor / 100 })),
      num_items: items.reduce((a, i) => a + i.quantity, 0),
    },
  };
}

export async function sendPurchaseToMeta(orderId: string) {
  if (!metaCapiConfigured()) return "not_configured" as const;
  const o = await db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!o || o.payment_status !== "paid") return "skipped" as const;
  if (o.ad_consent !== 1) return "no_consent" as const;
  const items = await db.selectFrom("order_items").select(["product_id", "quantity", "unit_price_minor"]).where("order_id", "=", orderId).execute();
  const event = purchaseCapiEvent(o, items, appUrl());
  if (!event) return "skipped" as const; // сума 0 або некоректна — подію без value не надсилаємо
  const body = {
    data: [event],
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  };
  const version = process.env.META_GRAPH_API_VERSION || "v22.0";
  try {
    const r = await fetch(`https://graph.facebook.com/${version}/${metaPixelId()}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN!)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000),
    });
    const ok = r.ok;
    await logOrderEvent(orderId, "note", null, null, "система", ok ? "Meta Conversions API: Purchase надіслано" : `Meta Conversions API: помилка ${r.status}`);
    return ok ? ("sent" as const) : ("failed" as const);
  } catch (e) {
    await logOrderEvent(orderId, "note", null, null, "система", `Meta Conversions API: мережа (${(e as Error).name})`);
    return "failed" as const;
  }
}
