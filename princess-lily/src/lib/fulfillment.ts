import "server-only";
import { sql } from "kysely";
import { db } from "@/db";
import type { VerifiedNotification } from "./payments/providers";
import { newId, newToken, sha256 } from "./ids";
import { appUrl, downloadMax, downloadTtlHours } from "./config";
import { escapeHtml, sendEmail } from "./email";
import { formatMinor } from "./money";

const nowIso = () => new Date().toISOString();

export type PaymentResult = "applied" | "duplicate" | "unknown_order" | "amount_mismatch" | "currency_mismatch" | "already_paid" | "failed_recorded" | "ignored";

/**
 * Обробка ПЕРЕВІРЕНОГО (підпис уже перевірено) повідомлення провайдера.
 * Ідемпотентно: унікальний (provider, event_id); повтор події нічого не змінює.
 * Перевіряє order_id, суму й валюту відносно збереженого замовлення.
 */
export async function processPaymentNotification(n: VerifiedNotification): Promise<PaymentResult> {
  const order = await db.selectFrom("orders").selectAll().where("id", "=", n.orderId).executeTakeFirst();
  let result: PaymentResult;
  if (!order) result = "unknown_order";
  else if (n.status === "success") {
    if (n.currency !== order.currency) result = "currency_mismatch";
    else if (n.amountMinor !== order.total_minor) result = "amount_mismatch";
    else if (order.payment_status === "paid") result = "already_paid";
    else result = "applied";
  } else if (n.status === "failure") result = order.payment_status === "paid" ? "ignored" : "failed_recorded";
  else result = "ignored";

  const ins = await db.insertInto("payment_events").values({
    id: newId("pev"), provider: n.provider, event_id: n.eventId.slice(0, 200), order_id: order?.id ?? null,
    amount_minor: n.amountMinor, currency: n.currency.slice(0, 8), reported_status: n.status, result,
  }).onConflict((oc) => oc.columns(["provider", "event_id"]).doNothing()).executeTakeFirst();
  if (!ins.numInsertedOrUpdatedRows || Number(ins.numInsertedOrUpdatedRows) === 0) return "duplicate";

  if (result === "applied") await markPaid(order!.id, { source: `provider:${n.provider}` });
  if (result === "failed_recorded")
    await db.updateTable("orders").set({ payment_status: "failed", updated_at: nowIso() }).where("id", "=", order!.id).where("payment_status", "in", ["pending_payment", "pending_verification"]).execute();
  if (result === "amount_mismatch" || result === "currency_mismatch")
    await db.updateTable("orders").set({ payment_status: "pending_verification", admin_note: sql`admin_note || ${`\n[${nowIso()}] Провайдер повідомив іншу суму/валюту: ${n.amountMinor} ${n.currency}. Перевірте вручну.`}`, updated_at: nowIso() })
      .where("id", "=", order!.id).where("payment_status", "!=", "paid").execute();
  return result;
}

/**
 * Переводить замовлення в «оплачено» рівно один раз (умовне оновлення) і запускає видачу.
 * Викликається з перевіреного вебхука або з ручного підтвердження адміністратора.
 */
export async function markPaid(orderId: string, by: { source: string }): Promise<boolean> {
  const res = await db.updateTable("orders").set({ payment_status: "paid", paid_at: nowIso(), updated_at: nowIso() })
    .where("id", "=", orderId).where("payment_status", "!=", "paid").where("payment_status", "!=", "cancelled").executeTakeFirst();
  if (Number(res.numUpdatedRows) !== 1) return false;
  const items = await db.selectFrom("order_items").selectAll().where("order_id", "=", orderId).execute();
  // Списання залишку друкованих книжок після оплати; нестачу позначаємо для адміністратора
  for (const it of items.filter((i) => i.format === "print")) {
    const r = await db.updateTable("product_variants").set((eb) => ({ stock: eb("stock", "-", it.quantity) }))
      .where("id", "=", it.variant_id).where("stock", ">=", it.quantity).executeTakeFirst();
    if (Number(r.numUpdatedRows) !== 1)
      await db.updateTable("orders").set({ admin_note: sql`admin_note || ${`\n[${nowIso()}] Недостатньо залишку для «${it.title_snapshot}» — перевірте.`}` }).where("id", "=", orderId).execute();
  }
  await db.updateTable("fulfillments").set({ status: "to_ship", updated_at: nowIso() }).where("order_id", "=", orderId).where("kind", "=", "shipping").where("status", "=", "awaiting_payment").execute();
  await db.updateTable("fulfillments").set({ status: "ready", updated_at: nowIso() }).where("order_id", "=", orderId).where("kind", "=", "digital").where("status", "=", "awaiting_payment").execute();
  if (items.some((i) => i.format === "pdf")) await deliverPdfEmail(orderId, `pdf:${orderId}`);
  void by;
  return true;
}

/** Видає нові тимчасові токени на PDF-позиції оплаченого замовлення. Повертає відкриті токени (зберігаються лише хеші). */
export async function issueDownloadGrants(orderId: string) {
  const order = await db.selectFrom("orders").select(["payment_status"]).where("id", "=", orderId).executeTakeFirst();
  if (order?.payment_status !== "paid") throw new Error("Замовлення не оплачене — посилання не видаються");
  const items = await db.selectFrom("order_items").selectAll().where("order_id", "=", orderId).where("format", "=", "pdf").execute();
  const expires = new Date(Date.now() + downloadTtlHours() * 3600_000).toISOString();
  const out: { itemId: string; title: string; bookLocale: string; token: string }[] = [];
  for (const it of items) {
    const token = newToken();
    await db.insertInto("download_grants").values({ id: newId("dlg"), order_id: orderId, order_item_id: it.id, token_hash: sha256(token), expires_at: expires, max_downloads: downloadMax() }).execute();
    out.push({ itemId: it.id, title: it.title_snapshot, bookLocale: it.book_locale, token });
  }
  return { grants: out, expires };
}

const RETRY_MIN = [5, 30, 120, 720];
export const MAX_EMAIL_ATTEMPTS = 5;

/**
 * Надсилає лист із посиланнями на PDF. dedupe_key гарантує, що успішно надісланий лист не дублюється
 * (повторні вебхуки/кліки). Для свідомого повторного надсилання адмінка передає новий ключ.
 */
export async function deliverPdfEmail(orderId: string, dedupeKey: string) {
  const order = await db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!order || order.payment_status !== "paid") return { status: "skipped" as const };
  let row = await db.selectFrom("email_deliveries").selectAll().where("dedupe_key", "=", dedupeKey).executeTakeFirst();
  if (row?.status === "sent") return { status: "sent" as const, duplicate: true };
  if (!row) {
    await db.insertInto("email_deliveries").values({ id: newId("eml"), order_id: orderId, kind: "pdf_links", dedupe_key: dedupeKey, to_email: order.email, status: "queued", last_error: null, provider_message_id: null, next_attempt_at: null, sent_at: null })
      .onConflict((oc) => oc.column("dedupe_key").doNothing()).execute();
    row = await db.selectFrom("email_deliveries").selectAll().where("dedupe_key", "=", dedupeKey).executeTakeFirstOrThrow();
    if (row.status === "sent") return { status: "sent" as const, duplicate: true };
  }
  // «Захоплюємо» спробу умовним оновленням, щоб паралельні виклики не надіслали лист двічі
  const claim = await db.updateTable("email_deliveries").set({ attempts: row.attempts + 1, status: "queued" })
    .where("id", "=", row.id).where("attempts", "=", row.attempts).where("status", "!=", "sent").executeTakeFirst();
  if (Number(claim.numUpdatedRows) !== 1) return { status: "in_progress" as const };

  const { grants, expires } = await issueDownloadGrants(orderId);
  const uk = order.site_locale === "uk";
  const links = grants.map((g) => ({ ...g, url: `${appUrl()}/api/download/${g.token}` }));
  const exp = new Date(expires).toLocaleString(uk ? "uk-UA" : "en-GB", { timeZone: "Europe/Kyiv", dateStyle: "medium", timeStyle: "short" });
  const subject = uk ? `Ваша книжка — замовлення ${order.number}` : `Your book — order ${order.number}`;
  const intro = uk ? `Дякуємо за замовлення ${order.number} (${formatMinor(order.total_minor, "uk")}).` : `Thank you for your order ${order.number} (${formatMinor(order.total_minor, "en")}).`;
  const note = uk
    ? `Посилання особисті й діють до ${exp} (до ${downloadMax()} завантажень). Електронна книга призначена для особистого використання.`
    : `These links are personal and valid until ${exp} (up to ${downloadMax()} downloads). The digital book is for personal use.`;
  const lang = (l: string) => (l === "uk" ? (uk ? "українська" : "Ukrainian") : uk ? "англійська" : "English");
  const text = [intro, "", ...links.map((l) => `${l.title} (PDF, ${lang(l.bookLocale)}): ${l.url}`), "", note].join("\n");
  const html = `<p>${escapeHtml(intro)}</p><ul>${links.map((l) => `<li><a href="${l.url}">${escapeHtml(l.title)}</a> — PDF, ${lang(l.bookLocale)}</li>`).join("")}</ul><p style="color:#555">${escapeHtml(note)}</p>`;

  const res = await sendEmail({ to: order.email, subject, text, html });
  if (res.ok) {
    await db.updateTable("email_deliveries").set({ status: "sent", provider_message_id: res.id, sent_at: nowIso(), last_error: null, next_attempt_at: null }).where("id", "=", row.id).execute();
    await db.updateTable("fulfillments").set({ status: "sent", updated_at: nowIso() }).where("order_id", "=", orderId).where("kind", "=", "digital").execute();
    return { status: "sent" as const };
  }
  // Невдала спроба: щойно видані токени відкликаємо (лист їх не доставив)
  await db.updateTable("download_grants").set({ revoked: 1 }).where("token_hash", "in", grants.map((g) => sha256(g.token)).concat("")).execute();
  const attempts = row.attempts + 1;
  const next = res.notConfigured || attempts >= MAX_EMAIL_ATTEMPTS ? null : new Date(Date.now() + RETRY_MIN[Math.min(attempts - 1, RETRY_MIN.length - 1)] * 60_000).toISOString();
  await db.updateTable("email_deliveries").set({ status: res.notConfigured ? "not_configured" : "failed", last_error: res.error, next_attempt_at: next }).where("id", "=", row.id).execute();
  await db.updateTable("fulfillments").set({ status: res.notConfigured ? "email_not_configured" : "email_failed", updated_at: nowIso() }).where("order_id", "=", orderId).where("kind", "=", "digital").execute();
  return { status: res.notConfigured ? ("not_configured" as const) : ("failed" as const), error: res.error };
}

/** Повторює листи, у яких настав час наступної спроби (для cron/скрипта `npm run email:retry`). */
export async function retryDueEmails() {
  const due = await db.selectFrom("email_deliveries").selectAll().where("status", "=", "failed").where("next_attempt_at", "is not", null).where("next_attempt_at", "<=", nowIso()).limit(20).execute();
  const out = [];
  for (const d of due) if (d.order_id) out.push(await deliverPdfEmail(d.order_id, d.dedupe_key));
  return out;
}

/** Перевірка й «використання» токена завантаження. Видає ключ файлу лише для оплаченого замовлення. */
export async function consumeDownload(token: string): Promise<{ ok: true; key: string; filename: string } | { ok: false; reason: "invalid" | "expired" | "exhausted" | "unpaid" | "no_file" }> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, reason: "invalid" };
  const g = await db.selectFrom("download_grants").selectAll().where("token_hash", "=", sha256(token)).executeTakeFirst();
  if (!g || g.revoked) return { ok: false, reason: "invalid" };
  if (new Date(g.expires_at) < new Date()) return { ok: false, reason: "expired" };
  const order = await db.selectFrom("orders").select(["payment_status", "number"]).where("id", "=", g.order_id).executeTakeFirst();
  if (order?.payment_status !== "paid") return { ok: false, reason: "unpaid" };
  const item = await db.selectFrom("order_items").selectAll().where("id", "=", g.order_item_id).where("order_id", "=", g.order_id).executeTakeFirst();
  if (!item || item.format !== "pdf") return { ok: false, reason: "invalid" };
  const v = await db.selectFrom("product_variants").select(["private_pdf_key"]).where("id", "=", item.variant_id).executeTakeFirst();
  if (!v?.private_pdf_key) return { ok: false, reason: "no_file" };
  const upd = await db.updateTable("download_grants").set({ download_count: g.download_count + 1 })
    .where("id", "=", g.id).where("download_count", "=", g.download_count).where("download_count", "<", g.max_downloads).executeTakeFirst();
  if (Number(upd.numUpdatedRows) !== 1) return { ok: false, reason: "exhausted" };
  const product = await db.selectFrom("products").select("slug").where("id", "=", item.product_id).executeTakeFirst();
  return { ok: true, key: v.private_pdf_key, filename: `${product?.slug ?? "book"}-${item.book_locale}-${order.number}.pdf` };
}
