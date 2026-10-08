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
import { privateStorage } from "@/lib/storage";

export type ActionState = { ok?: string; error?: string; links?: { title: string; url: string }[] };
const now = () => new Date().toISOString();
const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
const intOrNull = (v: string) => (v === "" ? null : Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);

/* ---------------- Товари ---------------- */

export async function createProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const slug = str(fd, "slug", 80).toLowerCase();
  const title = str(fd, "title", 200);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: "Адреса (slug): лише латиниця, цифри й дефіси" };
  if (!title) return { error: "Вкажіть назву" };
  if (await db.selectFrom("products").select("id").where("slug", "=", slug).executeTakeFirst()) return { error: "Така адреса вже існує" };
  const id = newId("prd");
  await db.insertInto("products").values({ id, slug, status: "draft", age_from: 2, age_to: 6, cover_base: null, cover_widths: "[]", cover_width: null, cover_height: null, pages: null, size_label: null, binding_label: null }).execute();
  await db.insertInto("product_translations").values({ product_id: id, locale: "uk", title, description: "", cover_alt: "", is_confirmed: 1 }).execute();
  await audit(admin, "product.create", "product", id, { slug });
  redirect(`/admin/products/${id}`);
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
  const ok = await markPaid(id, { source: `admin:${admin.email}` });
  await audit(admin, "order.payment_confirmed_manual", "order", id, { amount: o.total_minor, mode: o.payment_mode });
  revalidatePath(`/admin/orders/${id}`);
  return ok ? { ok: "Оплату підтверджено. Видачу запущено." } : { error: "Стан змінився — оновіть сторінку" };
}

export async function cancelOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 64);
  if (fd.get("confirm") !== "on") return { error: "Підтвердіть скасування позначкою" };
  const res = await db.updateTable("orders").set({ payment_status: "cancelled", updated_at: now() }).where("id", "=", id).where("payment_status", "!=", "cancelled").executeTakeFirst();
  await db.updateTable("download_grants").set({ revoked: 1 }).where("order_id", "=", id).execute();
  await db.updateTable("fulfillments").set({ status: "cancelled", updated_at: now() }).where("order_id", "=", id).where("kind", "=", "shipping").where("status", "in", ["awaiting_payment", "to_ship"]).execute();
  await audit(admin, "order.cancel", "order", id);
  revalidatePath(`/admin/orders/${id}`);
  return Number(res.numUpdatedRows) ? { ok: "Замовлення скасовано, посилання на PDF відкликано" } : { error: "Вже скасовано" };
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
  await db.updateTable("fulfillments").set({ status: status.data, ttn: ttn || null, updated_at: now() }).where("order_id", "=", id).where("kind", "=", "shipping").execute();
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
  await db.updateTable("orders").set({ admin_note: str(fd, "admin_note", 4000), updated_at: now() }).where("id", "=", id).execute();
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
  for (const k of SETTING_KEYS) await setSetting(k as SettingKey, str(fd, k, 2000));
  await audit(admin, "settings.update", "settings", undefined, { payment_link_set: !!url });
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
