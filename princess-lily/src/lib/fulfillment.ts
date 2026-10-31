import "server-only";
import { after } from "next/server";
import { sql } from "kysely";
import { db } from "@/db";
import type { VerifiedNotification } from "./payments/providers";
import { newId, newToken, sha256 } from "./ids";
import { appUrl, downloadMax, downloadTtlHours } from "./config";
import { escapeHtml, sendEmail } from "./email";
import { logOrderEvent } from "./events";
import { notifyPaid } from "./telegram";
import { adapterById } from "./payments/providers";
import { sendPurchaseToMeta } from "./meta-capi";
import { attachmentName, paymentReceipt, pdfEmailText, pdfFilesForOrder } from "./pdf-delivery";
import { privateStorage } from "./storage";
import { getSettings } from "./settings";

const nowIso = () => new Date().toISOString();

/** Виконати після відповіді (next/server after); поза запитом (скрипти, тести) — одразу. */
async function afterResponse(task: () => Promise<unknown>) {
  try { after(() => task().catch((e) => console.error("[after]", e))); } catch { await task(); }
}

export type PaymentResult = "applied" | "duplicate" | "unknown_order" | "amount_mismatch" | "currency_mismatch" | "already_paid" | "failed_recorded" | "ignored" | "not_confirmed";

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
    // додаткова серверна перевірка у провайдера (якщо адаптер це підтримує)
    const confirm = adapterById(n.provider)?.confirmWithProvider;
    if (result === "applied" && confirm && !(await confirm(n))) result = "not_confirmed";
  } else if (n.status === "failure") result = order.payment_status === "paid" ? "ignored" : "failed_recorded";
  else result = "ignored";

  const ins = await db.insertInto("payment_events").values({
    id: newId("pev"), provider: n.provider, event_id: n.eventId.slice(0, 200), order_id: order?.id ?? null,
    amount_minor: n.amountMinor, currency: n.currency.slice(0, 8), reported_status: n.status, result,
  }).onConflict((oc) => oc.columns(["provider", "event_id"]).doNothing()).executeTakeFirst();
  if (!ins.numInsertedOrUpdatedRows || Number(ins.numInsertedOrUpdatedRows) === 0) return "duplicate";

  if (n.paymentId && order) await db.updateTable("orders").set({ payment_reference: n.paymentId }).where("id", "=", order.id).where("payment_reference", "is", null).execute();
  if (result === "applied") await markPaid(order!.id, { source: `provider:${n.provider}` });
  if (result === "failed_recorded") {
    const f = await db.updateTable("orders").set({ payment_status: "failed", updated_at: nowIso() }).where("id", "=", order!.id).where("payment_status", "in", ["pending_payment", "pending_verification"]).executeTakeFirst();
    if (Number(f.numUpdatedRows)) await logOrderEvent(order!.id, "payment", order!.payment_status, "failed", `провайдер:${n.provider}`);
  }
  if (result === "amount_mismatch" || result === "currency_mismatch" || result === "not_confirmed")
    await logOrderEvent(order!.id, "payment", order!.payment_status, "pending_verification", `провайдер:${n.provider}`, `Відхилено автоматичне зарахування: ${result}`);
  if (result === "amount_mismatch" || result === "currency_mismatch" || result === "not_confirmed")
    await db.updateTable("orders").set({ payment_status: "pending_verification", admin_note: sql`admin_note || ${`\n[${nowIso()}] Провайдер повідомив іншу суму/валюту: ${n.amountMinor} ${n.currency}. Перевірте вручну.`}`, updated_at: nowIso() })
      .where("id", "=", order!.id).where("payment_status", "!=", "paid").execute();
  return result;
}

/**
 * Переводить замовлення в «оплачено» рівно один раз (умовне оновлення) і запускає видачу.
 * Викликається з перевіреного вебхука або з ручного підтвердження адміністратора.
 */
export async function markPaid(orderId: string, by: { source: string; checkedBy?: string }): Promise<boolean> {
  const before = await db.selectFrom("orders").select(["payment_status", "order_status"]).where("id", "=", orderId).executeTakeFirst();
  const res = await db.updateTable("orders").set({
    payment_status: "paid", paid_at: nowIso(), updated_at: nowIso(),
    payment_checked_by: by.checkedBy ?? by.source, payment_checked_at: nowIso(),
  }).where("id", "=", orderId).where("payment_status", "!=", "paid").where("payment_status", "!=", "cancelled").executeTakeFirst();
  if (Number(res.numUpdatedRows) !== 1) return false;
  await logOrderEvent(orderId, "payment", before?.payment_status ?? null, "paid", by.checkedBy ?? by.source);
  if (before?.order_status === "new") {
    await db.updateTable("orders").set({ order_status: "processing" }).where("id", "=", orderId).execute();
    await logOrderEvent(orderId, "order", "new", "processing", "система");
  }
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
  const pdfItems = items.filter((i) => i.format === "pdf");
  if (pdfItems.length) {
    const files = await pdfFilesForOrder(orderId);
    // лист із файлами — після відповіді банку/адмінці (може тривати кілька секунд); збій → повтори за розкладом
    if (files.length && files.every((f) => f.key)) await afterResponse(() => deliverPdfEmail(orderId, `pdf:${orderId}`));
    else {
      // файлу на сайті ще немає — книжку надсилає власниця сама (адмінка показує підказку й кнопку «PDF надіслано»)
      await db.updateTable("fulfillments").set({ status: "manual", updated_at: nowIso() }).where("order_id", "=", orderId).where("kind", "=", "digital").execute();
      await logOrderEvent(orderId, "digital", "ready", "manual", "система", "PDF-файлу немає на сайті — надішліть книжку покупцю вручну");
    }
  }
  // Telegram «оплату підтверджено» — лише тут, тобто після перевіреного вебхука або ручного підтвердження
  // Meta Conversions API — лише за згоди покупця й заданого токена; помилка не впливає на оплату
  await sendPurchaseToMeta(orderId).catch(() => {});
  await notifyPaid(orderId, by.source.startsWith("provider:") ? `підписаний вебхук ${by.source.slice(9)}` : `перевірено вручну: ${by.checkedBy ?? by.source}`).catch(() => {});
  return true;
}

/** Видає нові тимчасові токени на кожен PDF оплаченого замовлення (комплект — по файлу на книжку). Зберігаються лише хеші. */
export async function issueDownloadGrants(orderId: string) {
  const order = await db.selectFrom("orders").select(["payment_status"]).where("id", "=", orderId).executeTakeFirst();
  if (order?.payment_status !== "paid") throw new Error("Замовлення не оплачене — посилання не видаються");
  const files = await pdfFilesForOrder(orderId);
  const expires = new Date(Date.now() + downloadTtlHours() * 3600_000).toISOString();
  const out: { itemId: string; title: string; bookLocale: string; token: string }[] = [];
  for (const f of files) {
    const token = newToken();
    await db.insertInto("download_grants").values({ id: newId("dlg"), order_id: orderId, order_item_id: f.itemId, pdf_key: f.bundle ? f.key : null, file_title: f.bundle ? f.title : null, token_hash: sha256(token), expires_at: expires, max_downloads: downloadMax() }).execute();
    out.push({ itemId: f.itemId, title: f.title, bookLocale: f.locale, token });
  }
  return { grants: out, expires };
}

/** Межа вкладень: сумарний розмір PDF, після якого замість файлів надсилаються особисті посилання (ліміти пошти ~25 МБ). */
export const MAX_ATTACH_BYTES = 18 * 1024 * 1024;

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

  const uk = order.site_locale !== "en";
  const files = await pdfFilesForOrder(orderId);
  // файли книжок: вкладення, якщо все є й разом не завелике; інакше — особисті посилання
  const bufs = files.every((f) => f.key) ? await Promise.all(files.map((f) => privateStorage().get(f.key!))) : [];
  const attachBooks = bufs.length === files.length && bufs.every(Boolean) && bufs.reduce((a, b) => a + b!.length, 0) <= MAX_ATTACH_BYTES;
  let grants: { token: string; title: string; bookLocale: string }[] = [];
  let exp = "";
  if (!attachBooks) {
    const g = await issueDownloadGrants(orderId);
    grants = g.grants;
    exp = new Date(g.expires).toLocaleString(uk ? "uk-UA" : "en-GB", { timeZone: "Europe/Kyiv", dateStyle: "medium", timeStyle: "short" });
  }
  const lang = (l: string) => (l === "uk" ? (uk ? "українською" : "Ukrainian") : uk ? "англійською" : "English");
  const links = attachBooks ? null : grants.map((g) => ({ title: `${g.title} (PDF, ${lang(g.bookLocale)})`, url: `${appUrl()}/api/download/${g.token}` }));
  const { subject, lines } = pdfEmailText(uk ? "uk" : "en", order.number, links, exp);
  const receipt = await paymentReceipt(orderId).catch(() => null);
  const attachments = [
    ...(attachBooks ? files.map((f, i) => ({ filename: attachmentName(f.title, f.locale), content: bufs[i]!, contentType: "application/pdf" })) : []),
    ...(receipt ? [{ filename: receipt.filename, content: receipt.content, contentType: "application/pdf" }] : []),
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#2a2924;max-width:560px">${lines.map((l) => {
    const link = links?.find((x) => l === `${x.title}: ${x.url}`);
    return link ? `<p style="margin:0 0 6px"><a href="${link.url}">${escapeHtml(link.title)}</a></p>` : l ? `<p style="margin:0 0 4px">${escapeHtml(l)}</p>` : `<p style="margin:0 0 10px"></p>`;
  }).join("")}</div>`;
  const s = await getSettings();
  const res = await sendEmail({ to: order.email, subject, text, html, attachments, replyTo: s.contact_email || undefined });
  if (res.ok) {
    await db.updateTable("email_deliveries").set({ status: "sent", provider_message_id: res.id, sent_at: nowIso(), last_error: null, next_attempt_at: null }).where("id", "=", row.id).execute();
    await db.updateTable("fulfillments").set({ status: "sent", updated_at: nowIso() }).where("order_id", "=", orderId).where("kind", "=", "digital").execute();
    await logOrderEvent(orderId, "digital", null, "sent", "система", attachBooks ? `Лист із PDF у вкладенні надіслано (${files.length} файл.)${receipt ? " + квитанція" : ""}` : "Лист із посиланнями на PDF надіслано (файли завеликі для вкладення)");
    return { status: "sent" as const };
  }
  // Невдала спроба: щойно видані токени відкликаємо (лист їх не доставив)
  if (grants.length) await db.updateTable("download_grants").set({ revoked: 1 }).where("token_hash", "in", grants.map((g) => sha256(g.token)).concat("")).execute();
  const attempts = row.attempts + 1;
  const next = res.notConfigured || attempts >= MAX_EMAIL_ATTEMPTS ? null : new Date(Date.now() + RETRY_MIN[Math.min(attempts - 1, RETRY_MIN.length - 1)] * 60_000).toISOString();
  await db.updateTable("email_deliveries").set({ status: res.notConfigured ? "not_configured" : "failed", last_error: res.error, next_attempt_at: next }).where("id", "=", row.id).execute();
  await db.updateTable("fulfillments").set({ status: res.notConfigured ? "email_not_configured" : "email_failed", updated_at: nowIso() }).where("order_id", "=", orderId).where("kind", "=", "digital").execute();
  await logOrderEvent(orderId, "digital", null, res.notConfigured ? "email_not_configured" : "email_failed", "система", res.error);
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
  const fileKey = g.pdf_key ?? v?.private_pdf_key ?? null;
  if (!fileKey) return { ok: false, reason: "no_file" };
  const upd = await db.updateTable("download_grants").set({ download_count: g.download_count + 1 })
    .where("id", "=", g.id).where("download_count", "=", g.download_count).where("download_count", "<", g.max_downloads).executeTakeFirst();
  if (Number(upd.numUpdatedRows) !== 1) return { ok: false, reason: "exhausted" };
  const product = await db.selectFrom("products").select("slug").where("id", "=", item.product_id).executeTakeFirst();
  return { ok: true, key: fileKey, filename: g.file_title ? attachmentName(g.file_title, item.book_locale) : `${product?.slug ?? "book"}-${item.book_locale}-${order.number}.pdf` };
}
