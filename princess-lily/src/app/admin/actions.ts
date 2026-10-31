"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin, hashPassword, passwordProblem, verifyPassword, createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newId } from "@/lib/ids";
import { parseUahToMinor } from "@/lib/money";
import { markPaid, deliverPdfEmail, issueDownloadGrants } from "@/lib/fulfillment";
import { setSetting, SETTING_KEYS, type SettingKey } from "@/lib/settings";
import { appUrl } from "@/lib/config";
import { logOrderEvent, ORDER_TRANSITIONS } from "@/lib/events";
import { privateStorage, probeStoredFile, signedUploadUrl, storageSelfTest } from "@/lib/storage";
import { randomBytes } from "node:crypto";
import { getSettings } from "@/lib/settings";
import { sendEmail, escapeHtml } from "@/lib/email";
import { pdfEmailText } from "@/lib/pdf-delivery";
import { retryDueNotifications } from "@/lib/telegram";
import { rememberSlug } from "@/db/data-migrations";
import { deleteOrderCompletely } from "@/lib/orders";

export type ActionState = { ok?: string; error?: string; links?: { title: string; url: string }[] };
const now = () => new Date().toISOString();
const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
const intOrNull = (v: string) => (v === "" ? null : Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);

/* ---------------- Товари ---------------- */

/** Адреса сторінки з української назви (транслітерація), якщо її не вказано вручну. */
function slugify(s: string) {
  const m: Record<string, string> = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ю: "iu", я: "ia", ь: "", "’": "", "'": "" };
  return s.toLowerCase().split("").map((c) => m[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** Чернетка книжки для форми «Додати книжку» (обкладинки форма довантажує окремими запитами). */
export async function createBookDraftAction(fd: FormData): Promise<{ id?: string; error?: string }> {
  const r = await createProduct(fd);
  return "id" in r ? { id: r.id } : { error: r.error };
}

export async function createProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await createProduct(fd);
  if ("error" in r) return { error: r.error };
  redirect(`/admin/products/${r.id}`);
}

async function createProduct(fd: FormData): Promise<{ id: string } | { error: string }> {
  const admin = await requireAdmin();
  const title = str(fd, "title", 200);
  const slug = (str(fd, "slug", 80) || slugify(title)).toLowerCase();
  if (!title) return { error: "Вкажіть назву" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: "Адреса (slug): лише латиниця, цифри й дефіси" };
  if (await db.selectFrom("products").select("id").where("slug", "=", slug).executeTakeFirst()) return { error: "Така адреса вже існує" };
  const id = newId("prd");
  await db.insertInto("products").values({ id, slug, status: "draft", age_from: 2, age_to: 6, cover_base: null, cover_widths: "[]", cover_width: null, cover_height: null, pages: null, size_label: null, binding_label: null }).execute();
  await db.insertInto("product_translations").values([
    { product_id: id, locale: "uk", title, description: "", cover_alt: "", is_confirmed: 1 },
    { product_id: id, locale: "en", title: str(fd, "title_en", 200) || title, description: "", cover_alt: "", is_confirmed: str(fd, "title_en", 200) ? 1 : 0 },
  ]).execute();
  // чотири варіанти (UA/EN × PDF/друк) — неактивні, без ціни, доки власниця їх не заповнить
  for (const book_locale of ["uk", "en"] as const) for (const format of ["pdf", "print"] as const)
    await db.insertInto("product_variants").values({ id: newId("var"), product_id: id, book_locale, format, price_minor: null, stock: null, private_pdf_key: null, is_active: 0, restock_note: null }).execute();
  const max = await db.selectFrom("products").select(({ fn }) => fn.max<number>("sort_order").as("m")).executeTakeFirst();
  await db.updateTable("products").set({ sort_order: Number(max?.m ?? 0) + 1 }).where("id", "=", id).execute();
  await audit(admin, "product.create", "product", id, { slug });
  return { id };
}

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  const p = await db.selectFrom("products").selectAll().where("id", "=", id).executeTakeFirst();
  if (!p) return { error: "Товар не знайдено" };
  const status = z.enum(["draft", "coming_soon", "published"]).safeParse(str(fd, "status"));
  if (!status.success) return { error: "Невірний статус" };
  const slug = str(fd, "slug", 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: "Адреса (slug): лише латиниця, цифри й дефіси" };
  const clash = await db.selectFrom("products").select("id").where("slug", "=", slug).where("id", "!=", id).executeTakeFirst();
  if (clash) return { error: "Така адреса вже існує" };
  const nums = ["age_from", "age_to", "pages", "sort_order"].map((k) => intOrNull(str(fd, k, 6)));
  if (nums.some((n) => Number.isNaN(n))) return { error: "Числові поля мають бути цілими невід'ємними числами" };
  const [age_from, age_to, pages, sort_order] = nums;
  for (const loc of ["uk", "en"] as const) {
    const title = str(fd, `${loc}_title`, 200);
    const description = str(fd, `${loc}_description`, 8000);
    const cover_alt = str(fd, `${loc}_cover_alt`, 300);
    const is_confirmed = fd.get(`${loc}_confirmed`) === "on" ? 1 : 0;
    const ex = await db.selectFrom("product_translations").select("locale").where("product_id", "=", id).where("locale", "=", loc).executeTakeFirst();
    if (!title) { if (loc === "uk") return { error: "Українська назва обов'язкова" }; if (ex) await db.deleteFrom("product_translations").where("product_id", "=", id).where("locale", "=", loc).execute(); continue; }
    if (ex) await db.updateTable("product_translations").set({ title, description, cover_alt, is_confirmed }).where("product_id", "=", id).where("locale", "=", loc).execute();
    else await db.insertInto("product_translations").values({ product_id: id, locale: loc, title, description, cover_alt, is_confirmed }).execute();
  }
  // стара адреса продовжує працювати: сторінка постійно переадресовує на нову
  if (slug !== p.slug) await rememberSlug(db, p.slug, id);
  await db.updateTable("products").set({
    slug, status: status.data, age_from, age_to, pages, sort_order: sort_order ?? 0,
    size_label: str(fd, "size_label", 120) || null, binding_label: str(fd, "binding_label", 120) || null, updated_at: now(),
  }).where("id", "=", id).execute();
  await audit(admin, "product.update", "product", id, { status: status.data, statusBefore: p.status });
  revalidatePath("/admin/products");
  return { ok: "Збережено" };
}

const variantSchema = z.object({ book_locale: z.enum(["uk", "en"]), format: z.enum(["pdf", "print"]) });

export async function saveVariantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const productId = str(fd, "product_id", 64);
  const vid = str(fd, "id", 64);
  let price: number | null;
  try { price = parseUahToMinor(str(fd, "price", 20)); } catch { return { error: "Ціна: напр. 250 або 250.50" }; }
  if (price === 0) return { error: "Нульова ціна заборонена. Залиште порожнім, якщо ціни ще немає." };
  const stock = intOrNull(str(fd, "stock", 7));
  if (Number.isNaN(stock)) return { error: "Залишок — ціле невід'ємне число" };
  const is_active = fd.get("is_active") === "on" ? 1 : 0;
  const restock_note = str(fd, "restock_note", 300) || null;
  if (vid) {
    const v = await db.selectFrom("product_variants").selectAll().where("id", "=", vid).where("product_id", "=", productId).executeTakeFirst();
    if (!v) return { error: "Варіант не знайдено" };
    await db.updateTable("product_variants").set({ price_minor: price, stock: v.format === "print" ? stock : null, is_active, restock_note, updated_at: now() }).where("id", "=", vid).execute();
    // Ціни в уже оформлених замовленнях не змінюються: order_items зберігає знімок
    await audit(admin, "variant.update", "variant", vid, { priceBefore: v.price_minor, priceAfter: price, stock, is_active });
  } else {
    const k = variantSchema.safeParse({ book_locale: str(fd, "book_locale"), format: str(fd, "format") });
    if (!k.success) return { error: "Оберіть мову та формат" };
    if (!(await db.selectFrom("products").select("id").where("id", "=", productId).executeTakeFirst())) return { error: "Товар не знайдено" };
    const dup = await db.selectFrom("product_variants").select("id").where("product_id", "=", productId).where("book_locale", "=", k.data.book_locale).where("format", "=", k.data.format).executeTakeFirst();
    if (dup) return { error: "Такий варіант уже є" };
    const id = newId("var");
    await db.insertInto("product_variants").values({ id, product_id: productId, ...k.data, price_minor: price, stock: k.data.format === "print" ? stock : null, private_pdf_key: null, is_active, restock_note }).execute();
    await audit(admin, "variant.create", "variant", id, { ...k.data, price });
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: "Варіант збережено" };
}

export async function removePdfAction(fd: FormData) {
  const admin = await requireAdmin("owner");
  const vid = str(fd, "id", 64);
  const v = await db.selectFrom("product_variants").selectAll().where("id", "=", vid).executeTakeFirst();
  if (!v?.private_pdf_key) return;
  await db.updateTable("product_variants").set({ private_pdf_key: null, updated_at: now() }).where("id", "=", vid).execute();
  await privateStorage().remove(v.private_pdf_key).catch(() => {});
  await audit(admin, "variant.pdf_remove", "variant", vid);
  revalidatePath(`/admin/products/${v.product_id}`);
}

/* ---------------- Замовлення ---------------- */

export async function confirmPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  if (fd.get("confirm") !== "on") return { error: "Поставте позначку, що оплату звірено" };
  const o = await db.selectFrom("orders").select(["payment_status", "payment_mode", "total_minor"]).where("id", "=", id).executeTakeFirst();
  if (!o) return { error: "Замовлення не знайдено" };
  if (!["pending_payment", "pending_verification", "failed"].includes(o.payment_status)) return { error: "Замовлення вже оплачене або скасоване" };
  const ok = await markPaid(id, { source: `admin:${admin.email}`, checkedBy: admin.email });
  await audit(admin, "order.payment_confirmed_manual", "order", id, { amount: o.total_minor, mode: o.payment_mode });
  revalidatePath(`/admin/orders/${id}`);
  return ok ? { ok: "Оплату підтверджено. Видачу запущено." } : { error: "Стан змінився — оновіть сторінку" };
}

export async function cancelOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  if (fd.get("confirm") !== "on") return { error: "Підтвердіть скасування позначкою" };
  const before = await db.selectFrom("orders").select(["payment_status", "order_status"]).where("id", "=", id).executeTakeFirst();
  const res = await db.updateTable("orders").set({ payment_status: "cancelled", order_status: "cancelled", updated_at: now() }).where("id", "=", id).where("payment_status", "!=", "cancelled").executeTakeFirst();
  if (Number(res.numUpdatedRows)) {
    await logOrderEvent(id, "order", before?.order_status ?? null, "cancelled", admin.email);
    await logOrderEvent(id, "payment", before?.payment_status ?? null, "cancelled", admin.email);
  }
  await db.updateTable("download_grants").set({ revoked: 1 }).where("order_id", "=", id).execute();
  await db.updateTable("fulfillments").set({ status: "cancelled", updated_at: now() }).where("order_id", "=", id).where("kind", "=", "shipping").where("status", "in", ["awaiting_payment", "to_ship"]).execute();
  await audit(admin, "order.cancel", "order", id);
  revalidatePath(`/admin/orders/${id}`);
  return Number(res.numUpdatedRows) ? { ok: "Замовлення скасовано, посилання на PDF відкликано" } : { error: "Вже скасовано" };
}

/** Повне видалення помилкового замовлення (лише адміністратор, лише через сервер; у журналі дій лишається запис). */
export async function deleteOrderAction(fd: FormData): Promise<{ ok?: string; error?: string }> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  if (fd.get("confirm") !== "yes") return { error: "Підтвердіть видалення" };
  const r = await deleteOrderCompletely(id);
  if (!r) return { error: "Замовлення не знайдено (можливо, вже видалене)" };
  await audit(admin, "order.delete", "order", id, r);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: `Замовлення ${r.number} видалено` };
}

export async function shippingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  const status = z.enum(["to_ship", "shipped", "delivered", "cancelled"]).safeParse(str(fd, "status"));
  const ttn = str(fd, "ttn", 40).replace(/\s/g, "");
  if (!status.success) return { error: "Невірний статус доставки" };
  if (ttn && !/^\d{10,20}$/.test(ttn)) return { error: "ТТН Нової пошти — 10–20 цифр" };
  if (status.data === "shipped" && !ttn) return { error: "Для «Відправлено» вкажіть ТТН" };
  const o = await db.selectFrom("orders").select("payment_status").where("id", "=", id).executeTakeFirst();
  if (o?.payment_status !== "paid" && status.data !== "cancelled") return { error: "Доставка можлива лише після оплати" };
  const prev = await db.selectFrom("fulfillments").select(["status", "ttn"]).where("order_id", "=", id).where("kind", "=", "shipping").executeTakeFirst();
  await db.updateTable("fulfillments").set({ status: status.data, ttn: ttn || null, updated_at: now() }).where("order_id", "=", id).where("kind", "=", "shipping").execute();
  if (prev?.status !== status.data || (prev?.ttn ?? "") !== ttn) await logOrderEvent(id, "shipping", prev?.status ?? null, status.data, admin.email, ttn ? `ТТН ${ttn}` : undefined);
  await audit(admin, "order.shipping", "order", id, { status: status.data, ttn });
  revalidatePath(`/admin/orders/${id}`);
  return { ok: "Доставку оновлено" };
}

export async function resendPdfAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  const r = await deliverPdfEmail(id, `pdf:${id}:manual:${Date.now()}`);
  await audit(admin, "order.pdf_resend", "order", id, { status: r.status });
  revalidatePath(`/admin/orders/${id}`);
  if (r.status === "sent") return { ok: "Лист надіслано" };
  if (r.status === "not_configured") return { error: "Email-провайдер не налаштовано. Скористайтеся «Створити посилання» і надішліть його вручну." };
  if (r.status === "skipped") return { error: "Замовлення не оплачене" };
  return { error: `Не вдалося: ${"error" in r ? r.error : r.status}` };
}

/** Власниця надіслала PDF покупцю сама (файлу на сайті немає). */
export async function markPdfSentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  const r = await db.updateTable("fulfillments").set({ status: "sent", updated_at: new Date().toISOString() }).where("order_id", "=", id).where("kind", "=", "digital").where("status", "=", "manual").executeTakeFirst();
  if (Number(r.numUpdatedRows) !== 1) return { error: "Немає PDF, що чекає ручного надсилання" };
  await logOrderEvent(id, "digital", "manual", "sent", admin.email, "PDF надіслано покупцю вручну");
  await audit(admin, "order.pdf_manual_sent", "order", id);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: "Позначено: PDF надіслано" };
}

/** Одноразовий показ нових посилань на PDF (для ручного надсилання, коли email не налаштовано). */
export async function makeLinksAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  try {
    const { grants } = await issueDownloadGrants(id);
    await audit(admin, "order.pdf_links_created", "order", id, { count: grants.length });
    return { ok: "Посилання створено (показуються один раз)", links: grants.map((g) => ({ title: `${g.title} (${g.bookLocale})`, url: `${appUrl()}/api/download/${g.token}` })) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function orderNoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  await db.updateTable("orders").set({ admin_note: str(fd, "admin_note", 4000), sender_contact: str(fd, "sender_contact", 300) || null, updated_at: now() }).where("id", "=", id).execute();
  await logOrderEvent(id, "note", null, null, admin.email, "Оновлено внутрішню примітку / дані відправника");
  await audit(admin, "order.note", "order", id);
  return { ok: "Нотатку збережено" };
}

/* ---------------- Звернення ---------------- */

export async function messageAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  const status = z.enum(["new", "in_progress", "closed"]).parse(str(fd, "status"));
  await db.updateTable("contact_messages").set({ status, admin_note: str(fd, "admin_note", 2000) }).where("id", "=", id).execute();
  await audit(admin, "message.update", "message", id, { status });
  revalidatePath("/admin/messages");
}

/* ---------------- Налаштування ---------------- */

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin("owner");
  const url = str(fd, "payment_link_url", 500);
  if (url && !/^https:\/\/[^\s]+$/.test(url)) return { error: "Платіжне посилання має починатися з https://" };
  const email = str(fd, "contact_email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Невірний email" };
  const mode = str(fd, "payment_mode", 30);
  if (mode && !["manual_link", "mono_acquiring", "disabled"].includes(mode)) return { error: "Невірний режим оплати" };
  for (const k of SETTING_KEYS) if (fd.has(k)) await setSetting(k as SettingKey, str(fd, k, 2000));
  await audit(admin, "settings.update", "settings", undefined, { payment_link_set: !!url, payment_mode: mode });
  revalidatePath("/", "layout");
  return { ok: "Налаштування збережено" };
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const cur = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? "");
  if (!(await verifyPassword(admin.email, cur))) return { error: "Поточний пароль невірний" };
  const prob = passwordProblem(next, admin.email);
  if (prob) return { error: prob };
  const u = await db.selectFrom("admin_users").select(["session_version"]).where("id", "=", admin.id).executeTakeFirstOrThrow();
  await db.updateTable("admin_users").set({ password_hash: await hashPassword(next), session_version: u.session_version + 1 }).where("id", "=", admin.id).execute();
  await createSession({ id: admin.id, email: admin.email, session_version: u.session_version + 1 }); // інші сесії анульовано
  await audit(admin, "account.password_change");
  return { ok: "Пароль змінено; інші сесії завершено" };
}

/** Зміна загального статусу замовлення — лише дозволені переходи, з хронологією. */
export async function orderStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64), to = str(fd, "order_status", 20);
  const o = await db.selectFrom("orders").select("order_status").where("id", "=", id).executeTakeFirst();
  if (!o) return { error: "Замовлення не знайдено" };
  const from = o.order_status ?? "new";
  if (from === to) return { ok: "Без змін" };
  if (!(ORDER_TRANSITIONS[from] ?? []).includes(to)) return { error: `Перехід «${from} → ${to}» не дозволено` };
  await db.updateTable("orders").set({ order_status: to as never, updated_at: now() }).where("id", "=", id).execute();
  await logOrderEvent(id, "order", from, to, admin.email);
  await audit(admin, "order.status", "order", id, { from, to });
  revalidatePath(`/admin/orders/${id}`);
  return { ok: "Статус оновлено" };
}

export async function retryNotificationsAction(): Promise<ActionState> {
  const admin = await requireAdmin();
  const r = await retryDueNotifications(true);
  await audit(admin, "notifications.retry", "notifications", undefined, { count: r.length });
  revalidatePath("/admin");
  return r.length ? { ok: `Оброблено: ${r.join(", ")}` } : { ok: "Немає сповіщень для повтору" };
}

/** Видалення розвороту книжки. */
export async function deleteImageAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  const im = await db.selectFrom("product_images").select(["id", "product_id"]).where("id", "=", id).executeTakeFirst();
  if (!im) return;
  await db.deleteFrom("product_images").where("id", "=", id).execute();
  await audit(admin, "product.spread_delete", "product", im.product_id, { image: id });
  revalidatePath(`/admin/products/${im.product_id}`);
}

/** Швидка зміна статусу й порядку зі списку товарів. */
export async function quickProductAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  const status = z.enum(["draft", "coming_soon", "published"]).safeParse(str(fd, "status"));
  const order = intOrNull(str(fd, "sort_order", 6));
  const p = await db.selectFrom("products").select(["status", "sort_order"]).where("id", "=", id).executeTakeFirst();
  if (!p) return;
  const set: { status?: "draft" | "coming_soon" | "published"; sort_order?: number; updated_at: string } = { updated_at: now() };
  if (status.success) set.status = status.data;
  if (order !== null && !Number.isNaN(order)) set.sort_order = order;
  await db.updateTable("products").set(set).where("id", "=", id).execute();
  await audit(admin, "product.quick_update", "product", id, { from: p.status, to: set.status ?? p.status, sort: set.sort_order ?? p.sort_order });
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
}

/* ---------------- PDF книжок: пряме завантаження в приватне сховище ---------------- */

/** Крок 1: підписане посилання для завантаження PDF прямо в Supabase (великі файли не проходять через сервер). */
export async function pdfUploadStartAction(variantId: string): Promise<{ mode: "direct"; url: string; key: string } | { mode: "server" } | { error: string }> {
  const admin = await requireAdmin("owner");
  void admin;
  const v = await db.selectFrom("product_variants").select(["id", "format"]).where("id", "=", String(variantId).slice(0, 64)).executeTakeFirst();
  if (!v || v.format !== "pdf") return { error: "Варіант не знайдено" };
  const key = `pdf/${v.id.toLowerCase().replace(/[^a-z0-9_-]/g, "")}-${randomBytes(8).toString("hex")}.pdf`;
  const signed = await signedUploadUrl(key);
  if (!signed) return { mode: "server" }; // локальне/базове сховище — через звичайний ендпоінт
  if ("error" in signed) return { error: signed.error };
  return { mode: "direct", url: signed.url, key };
}

/** Крок 2: перевірка, що в сховищі справді PDF, і прив'язка файлу до варіанта (старий файл видаляється). */
export async function pdfUploadFinishAction(variantId: string, key: string): Promise<{ ok?: string; error?: string }> {
  const admin = await requireAdmin("owner");
  const v = await db.selectFrom("product_variants").select(["id", "format", "private_pdf_key"]).where("id", "=", String(variantId).slice(0, 64)).executeTakeFirst();
  if (!v || v.format !== "pdf") return { error: "Варіант не знайдено" };
  const expected = `pdf/${v.id.toLowerCase().replace(/[^a-z0-9_-]/g, "")}-`;
  if (!key.startsWith(expected) || !/^pdf\/[a-z0-9_-]+\.pdf$/.test(key)) return { error: "Невірний файл" };
  const probe = await probeStoredFile(key);
  if (!probe) return { error: "Файл не знайдено у сховищі — спробуйте завантажити ще раз" };
  if (!probe.head.startsWith("%PDF-")) { await privateStorage().remove(key).catch(() => {}); return { error: "Це не PDF-файл" }; }
  await db.updateTable("product_variants").set({ private_pdf_key: key, updated_at: now() }).where("id", "=", v.id).execute();
  if (v.private_pdf_key && v.private_pdf_key !== key) await privateStorage().remove(v.private_pdf_key).catch(() => {});
  await audit(admin, "variant.pdf_upload", "variant", v.id, { bytes: probe.size, direct: true });
  revalidatePath(`/admin/products`);
  return { ok: `Завантажено (${(probe.size / 1048576).toFixed(1)} МБ)` };
}

/* ---------------- Перевірки сховища й пошти ---------------- */

export async function storageCheckAction(): Promise<ActionState> {
  await requireAdmin("owner");
  const r = await storageSelfTest();
  return r.ok ? { ok: `Сховище працює (${r.kind})` } : { error: `Сховище (${r.kind}) не працює: ${r.error}` };
}

/** Тестовий лист на email магазину: той самий текст, що отримає покупець, з тестовим PDF у вкладенні. */
export async function emailTestAction(): Promise<ActionState> {
  await requireAdmin("owner");
  const s = await getSettings();
  if (!s.contact_email) return { error: "Спершу вкажіть «Email для зв’язку» в налаштуваннях" };
  const { subject, lines } = pdfEmailText("uk", "PL-TEST", null);
  const res = await sendEmail({
    to: s.contact_email, subject: `[ТЕСТ] ${subject}`, text: lines.join("\n"), replyTo: s.contact_email,
    html: lines.map((l) => (l ? `<p style="margin:0 0 4px">${escapeHtml(l)}</p>` : "<br>")).join(""),
    attachments: [{ filename: "Test-UA.pdf", content: Buffer.from("%PDF-1.4\n% test\n"), contentType: "application/pdf" }],
  });
  return res.ok ? { ok: `Тестовий лист надіслано на ${s.contact_email} — перевірте пошту (і «Спам»)` } : { error: res.error };
}
