import "server-only";
import { db } from "@/db";
import { newId } from "./ids";
import { appUrl } from "./config";
import { formatMinor } from "./money";
import { escapeHtml } from "./email";

/**
 * Сповіщення власниці в Telegram (бот магазину) через офіційний Bot API sendMessage.
 * TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID — лише змінні середовища сервера.
 * Outbox: кожне сповіщення має dedupe_key (без дублів при повторах), статус, спроби, помилку, час наступної спроби.
 * Відправка ніколи не блокує й не ламає оформлення замовлення.
 */
export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;

type SendResult = { ok: true } | { ok: false; error: string; retryAfterSec?: number; permanent?: boolean };

export async function telegramSend(text: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { ok: false, error: "Telegram не налаштовано (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)", permanent: true };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string; error_code?: number; parameters?: { retry_after?: number } };
    if (r.ok && j.ok) return { ok: true };
    // текст помилки без токена
    const err = `Telegram ${j.error_code ?? r.status}: ${j.description ?? "помилка"}`.slice(0, 300);
    return { ok: false, error: err, retryAfterSec: j.parameters?.retry_after, permanent: r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404 };
  } catch (e) {
    return { ok: false, error: `Мережа: ${(e as Error).name}`.slice(0, 200) };
  }
}

const BACKOFF_MIN = [1, 5, 15, 60, 240];
export const MAX_TG_ATTEMPTS = 6;

/** Ставить сповіщення в outbox (ідемпотентно за dedupe_key) і одразу пробує надіслати. */
export async function enqueueTelegram(dedupeKey: string, orderId: string | null, text: string) {
  const ins = await db.insertInto("notifications").values({
    id: newId("ntf"), channel: "telegram", dedupe_key: dedupeKey, order_id: orderId, payload: text,
    status: telegramConfigured() ? "queued" : "not_configured", last_error: telegramConfigured() ? null : "Telegram не налаштовано",
    next_attempt_at: null, sent_at: null, created_at: new Date().toISOString(),
  }).onConflict((oc) => oc.column("dedupe_key").doNothing()).executeTakeFirst();
  // вже існує (повторний виклик) — не обходимо backoff; повтори робить retryDueNotifications
  if (!Number(ins.numInsertedOrUpdatedRows ?? 0)) return "exists";
  return deliverNotification(dedupeKey);
}

export async function deliverNotification(dedupeKey: string) {
  const n = await db.selectFrom("notifications").selectAll().where("dedupe_key", "=", dedupeKey).executeTakeFirst();
  if (!n || n.status === "sent") return n?.status ?? "missing";
  if (!telegramConfigured()) {
    await db.updateTable("notifications").set({ status: "not_configured", last_error: "Telegram не налаштовано" }).where("id", "=", n.id).execute();
    return "not_configured";
  }
  // захоплюємо спробу умовним оновленням — паралельні виклики не надішлють двічі
  const claim = await db.updateTable("notifications").set({ attempts: n.attempts + 1 })
    .where("id", "=", n.id).where("attempts", "=", n.attempts).where("status", "!=", "sent").executeTakeFirst();
  if (Number(claim.numUpdatedRows) !== 1) return "in_progress";
  const r = await telegramSend(n.payload);
  if (r.ok) {
    await db.updateTable("notifications").set({ status: "sent", sent_at: new Date().toISOString(), last_error: null, next_attempt_at: null }).where("id", "=", n.id).execute();
    return "sent";
  }
  const attempts = n.attempts + 1;
  const delayMin = r.retryAfterSec ? Math.ceil(r.retryAfterSec / 60) : BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
  const next = r.permanent || attempts >= MAX_TG_ATTEMPTS ? null : new Date(Date.now() + delayMin * 60_000).toISOString();
  await db.updateTable("notifications").set({ status: "failed", last_error: r.error, next_attempt_at: next }).where("id", "=", n.id).execute();
  return "failed";
}

/** Повтор невдалих/ненадісланих (cron `npm run notify:retry` або кнопка в адмінці). */
export async function retryDueNotifications(force = false) {
  let q = db.selectFrom("notifications").select("dedupe_key").where("status", "in", ["failed", "not_configured", "queued"]).limit(30);
  if (!force) q = q.where("next_attempt_at", "is not", null).where("next_attempt_at", "<=", new Date().toISOString());
  const rows = await q.execute();
  const out: string[] = [];
  for (const r of rows) out.push(await deliverNotification(r.dedupe_key));
  return out;
}

const kyivTime = (iso: string) => new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });
const FORMAT = { pdf: "PDF", print: "друк" } as const;

/** Текст про нове збережене замовлення (без зайвих персональних даних: лише ім'я). */
export async function notifyNewOrder(orderId: string) {
  const o = await db.selectFrom("orders").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!o) return;
  const items = await db.selectFrom("order_items").selectAll().where("order_id", "=", orderId).execute();
  const kinds = new Set(items.map((i) => i.format));
  const kind = kinds.size > 1 ? "змішане (PDF + друк)" : kinds.has("pdf") ? "PDF" : "друковане";
  const text = [
    `🆕 <b>Нове замовлення ${escapeHtml(o.number)}</b>`,
    `🕒 ${kyivTime(o.created_at.includes("T") ? o.created_at : o.created_at.replace(" ", "T") + "Z")} (Київ)`,
    `👤 ${escapeHtml(o.name)}`,
    ...items.map((i) => `• ${escapeHtml(i.title_snapshot)} — ${FORMAT[i.format]}, ${i.book_locale === "uk" ? "укр." : "англ."} × ${i.quantity}`),
    `💳 ${formatMinor(o.total_minor, "uk")}${o.shipping_required ? " + доставка за тарифами НП" : ""}`,
    `📦 ${kind}${o.shipping_required ? ` · НП: ${escapeHtml(o.np_city ?? "")}` : ""}`,
    `Оплата: ${o.payment_status === "paid" ? "оплачено" : "очікує оплату (НЕ підтверджено)"}`,
    `🔐 ${appUrl()}/admin/orders/${o.id}`,
  ].join("\n");
  return enqueueTelegram(`tg:new:${orderId}`, orderId, text);
}

/** Лише після фактичної перевірки (підписаний вебхук або ручне підтвердження адміністратора). */
export async function notifyPaid(orderId: string, how: string) {
  const o = await db.selectFrom("orders").select(["number", "total_minor", "payment_status", "id"]).where("id", "=", orderId).executeTakeFirst();
  if (!o || o.payment_status !== "paid") return;
  const text = `✅ <b>Оплату підтверджено: ${escapeHtml(o.number)}</b>\n💳 ${formatMinor(o.total_minor, "uk")} · ${escapeHtml(how)}\n🔐 ${appUrl()}/admin/orders/${o.id}`;
  return enqueueTelegram(`tg:paid:${orderId}`, orderId, text);
}
