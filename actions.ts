"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import type { OrderStatus, PriceType, Unit } from "@/db/types";
import { requireAdmin, verifyPassword, createSession, destroySession, consumeResetToken, setPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { newId } from "@/lib/ids";
import { ALL_STATUSES, addEvent, changeStatus, reschedule } from "@/lib/orders";
import { setSetting } from "@/lib/settings";
import { dateRange, isIsoDate } from "@/lib/dates";
import { saveProductPhoto, deletePhotoFile } from "@/lib/uploads";
import { textToOptions } from "@/lib/options";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const done = (message = "Збережено"): ActionResult => ({ ok: true, message });
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ---------- Вхід ----------
export async function login(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!(await rateLimit("login", 10, 900))) return fail("Забагато спроб. Спробуйте через 15 хвилин.");
  const user = await verifyPassword(str(fd, "email"), String(fd.get("password") ?? ""));
  if (!user) return fail("Невірний email або пароль.");
  await createSession(user);
  redirect("/admin");
}
export async function logout() { await destroySession(); redirect("/admin/login"); }

export async function resetPassword(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const token = str(fd, "token"); const pw = String(fd.get("password") ?? "");
  if (pw.length < 10) return fail("Пароль має бути щонайменше 10 символів.");
  const userId = await consumeResetToken(token);
  if (!userId) return fail("Посилання недійсне або прострочене. Створіть нове командою на сервері.");
  await setPassword(userId, pw);
  return done("Пароль змінено. Тепер увійдіть.");
}
export async function changePassword(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const current = String(fd.get("current") ?? ""); const next = String(fd.get("next") ?? "");
  if (next.length < 10) return fail("Новий пароль має бути щонайменше 10 символів.");
  if (!(await verifyPassword(s.email, current))) return fail("Поточний пароль невірний.");
  await setPassword(s.sub, next);
  return done("Пароль змінено.");
}

// ---------- Заявки ----------
export async function updateOrderStatus(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const id = str(fd, "id"); const status = str(fd, "status") as OrderStatus;
  if (!ALL_STATUSES.includes(status)) return fail("Невідомий статус");
  const r = await changeStatus(id, status, s.email);
  revalidatePath("/admin"); revalidatePath(`/admin/orders/${id}`);
  return r.ok ? done("Статус оновлено. Клієнту повідомлення НЕ надсилається автоматично.") : fail(r.error);
}
export async function saveOrderDetails(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const id = str(fd, "id");
  const finalRaw = str(fd, "finalPrice").replace(",", ".");
  const finalPrice = finalRaw === "" ? null : Math.round(Number(finalRaw) * 100);
  if (finalPrice != null && (!Number.isFinite(finalPrice) || finalPrice < 0)) return fail("Некоректна сума.");
  const notes = str(fd, "adminNotes").slice(0, 4000);
  const prev = await db.selectFrom("orders").select(["final_price", "admin_notes"]).where("id", "=", id).executeTakeFirst();
  if (!prev) return fail("Заявку не знайдено");
  await db.updateTable("orders").set({ final_price: finalPrice, admin_notes: notes, updated_at: new Date().toISOString() }).where("id", "=", id).execute();
  if (prev.final_price !== finalPrice) await addEvent(id, "FINAL_PRICE", { from: prev.final_price, to: finalPrice, by: s.email });
  if (prev.admin_notes !== notes) await addEvent(id, "NOTES", { by: s.email });
  revalidatePath(`/admin/orders/${id}`);
  return done();
}
export async function rescheduleOrder(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const id = str(fd, "id"); const date = str(fd, "date");
  if (!isIsoDate(date)) return fail("Оберіть дату");
  const r = await reschedule(id, date, s.email);
  revalidatePath(`/admin/orders/${id}`); revalidatePath("/admin/calendar");
  return r.ok ? done("Дату змінено, історію збережено.") : fail(r.error);
}

// ---------- Календар ----------
export async function setDays(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const from = str(fd, "from"); const to = str(fd, "to") || from;
  const mode = str(fd, "mode"); // close | open
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) return fail("Перевірте дати.");
  const days = dateRange(from, to);
  if (days.length > 366) return fail("Забагато днів за раз.");
  const affected = await db.selectFrom("orders").select(({ fn }) => fn.countAll<number>().as("n")).where("desired_date", "in", days).where("status", "in", ["CONFIRMED", "IN_PROGRESS"]).executeTakeFirstOrThrow();
  for (const date of days) {
    const ex = await db.selectFrom("calendar_days").select("date").where("date", "=", date).executeTakeFirst();
    if (ex) await db.updateTable("calendar_days").set({ is_closed: mode === "close" ? 1 : 0 }).where("date", "=", date).execute();
    else await db.insertInto("calendar_days").values({ date, is_closed: mode === "close" ? 1 : 0, note: "", day_limit: null }).execute();
  }
  revalidatePath("/admin/calendar");
  const n = Number(affected.n);
  return done(mode === "close"
    ? `Закрито днів: ${days.length}.${n ? ` Увага: на ці дати є ${n} підтверджених замовлень — вони НЕ скасовані.` : ""}`
    : `Відкрито днів: ${days.length}.`);
}
export async function saveDay(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const date = str(fd, "date");
  if (!isIsoDate(date)) return fail("Некоректна дата");
  const limitRaw = str(fd, "limit");
  const limit = limitRaw === "" ? null : Number(limitRaw);
  if (limit != null && (!Number.isInteger(limit) || limit < 0)) return fail("Ліміт має бути цілим числом або порожнім.");
  const note = str(fd, "note").slice(0, 1000);
  const ex = await db.selectFrom("calendar_days").select("date").where("date", "=", date).executeTakeFirst();
  if (ex) await db.updateTable("calendar_days").set({ note, day_limit: limit }).where("date", "=", date).execute();
  else await db.insertInto("calendar_days").values({ date, is_closed: 0, note, day_limit: limit }).execute();
  revalidatePath("/admin/calendar");
  return done();
}

// ---------- Каталог ----------
const units: Unit[] = ["KG", "PIECE", "BOX", "BOUQUET"];
const priceTypes: PriceType[] = ["FIXED", "RANGE", "FROM", "ASK"];
const toKop = (s: string) => { if (s === "") return null; const n = Number(s.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN; };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + newId().slice(0, 4);

export async function saveCategory(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id"); const name = str(fd, "name"); const unit = str(fd, "unit") as Unit;
  if (name.length < 1) return fail("Вкажіть назву");
  if (!units.includes(unit)) return fail("Оберіть одиницю");
  const data = { name, unit, description: str(fd, "description"), image_path: str(fd, "image_path") || null, sort_order: Number(str(fd, "sort_order") || 0) };
  if (id) await db.updateTable("categories").set(data).where("id", "=", id).execute();
  else await db.insertInto("categories").values({ id: newId(), slug: slugify(name), ...data }).execute();
  revalidatePath("/admin/catalog"); revalidatePath("/");
  return done();
}
export async function saveProduct(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id"); const name = str(fd, "name");
  const unit = str(fd, "unit") as Unit; const priceType = str(fd, "price_type") as PriceType;
  if (name.length < 1) return fail("Вкажіть назву");
  if (!units.includes(unit)) return fail("Оберіть одиницю продажу");
  if (!priceTypes.includes(priceType)) return fail("Оберіть тип ціни");
  const priceMin = toKop(str(fd, "price_min")); const priceMax = toKop(str(fd, "price_max"));
  if (Number.isNaN(priceMin) || Number.isNaN(priceMax)) return fail("Ціна має бути числом");
  if (priceType !== "ASK" && priceMin == null) return fail("Вкажіть ціну");
  if (priceType === "RANGE" && (priceMax == null || priceMax < priceMin!)) return fail("Для діапазону вкажіть «до», не менше за «від»");
  const minQtyRaw = str(fd, "min_qty").replace(",", ".");
  const minQty = minQtyRaw === "" ? null : (unit === "KG" ? Math.round(Number(minQtyRaw) * 1000) : Number(minQtyRaw));
  if (minQty != null && (!Number.isFinite(minQty) || minQty < 0 || (unit !== "KG" && !Number.isInteger(minQty)))) return fail("Некоректний мінімум");
  const fillings = str(fd, "fillings").split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  const categoryId = str(fd, "category_id");
  if (!(await db.selectFrom("categories").select("id").where("id", "=", categoryId).executeTakeFirst())) return fail("Категорію не знайдено");
  const data = {
    category_id: categoryId, name, description: str(fd, "description"), unit, price_type: priceType,
    price_min: priceType === "ASK" ? null : priceMin, price_max: priceType === "RANGE" ? priceMax : null,
    min_qty: minQty, fillings: JSON.stringify(fillings), options: JSON.stringify(textToOptions(str(fd, "options"))), size_label: str(fd, "size_label") || null,
    image_path: str(fd, "image_path") || null, sort_order: Number(str(fd, "sort_order") || 0), updated_at: new Date().toISOString(),
  };
  if (id) await db.updateTable("products").set(data).where("id", "=", id).execute();
  else await db.insertInto("products").values({ id: newId(), slug: slugify(name), ...data }).execute();
  revalidatePath("/admin/catalog"); revalidatePath("/");
  return done("Збережено. Старі заявки зберігають свій прайс.");
}
export async function toggleProduct(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id"); const field = str(fd, "field"); const value = str(fd, "value") === "1" ? 1 : 0;
  const table = str(fd, "table") === "categories" ? "categories" : "products";
  if (field !== "is_visible" && field !== "is_archived") return fail("Невідоме поле");
  await db.updateTable(table).set({ [field]: value }).where("id", "=", id).execute();
  revalidatePath("/admin/catalog"); revalidatePath("/");
  return done(field === "is_archived" ? (value ? "Архівовано. Старі заявки не змінилися." : "Відновлено з архіву.") : (value ? "Показано на сайті." : "Приховано з сайту."));
}

// ---------- Фото ----------
export async function uploadPhoto(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return fail("Оберіть файл");
  try {
    const { path, width, height } = await saveProductPhoto(f);
    const max = await db.selectFrom("photos").select(({ fn }) => fn.max("sort_order").as("m")).executeTakeFirst();
    await db.insertInto("photos").values({ id: newId(), path, alt: str(fd, "alt"), in_gallery: fd.get("in_gallery") ? 1 : 0, sort_order: Number(max?.m ?? -1) + 1, width, height }).execute();
  } catch (e) { return fail((e as Error).message); }
  revalidatePath("/admin/photos");
  return done("Фото завантажено");
}

// ---------- Налаштування ----------
const settingKeys = ["brand_name", "owner_name", "city", "phone", "instagram_url", "hero_title", "hero_subtitle", "lead_days", "cupcake_min_batch", "about_text", "about_photo", "order_terms", "faq"];
export async function saveSettings(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  for (const key of settingKeys) {
    if (!fd.has(key)) continue;
    let v = String(fd.get(key) ?? "");
    if (key === "lead_days" && (!/^\d{1,3}$/.test(v))) return fail("Термін замовлення — ціле число днів");
    if (key === "cupcake_min_batch" && v !== "" && !/^\d{1,4}$/.test(v)) return fail("Мінімальна партія — ціле число або порожньо");
    if (key === "faq") { try { const arr = JSON.parse(v); if (!Array.isArray(arr)) throw 0; v = JSON.stringify(z.array(z.object({ q: z.string(), a: z.string() })).parse(arr)); } catch { return fail("FAQ має бути списком запитань і відповідей"); } }
    await setSetting(key, v);
  }
  revalidatePath("/"); revalidatePath("/admin/settings");
  return done();
}

// ---------- Відгуки ----------
import { saveReviewPrivate, publishReviewFile, unpublishReviewFile, deleteReviewFiles } from "@/lib/uploads";

export async function uploadReview(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return fail("Оберіть файл");
  try {
    const { name, width, height } = await saveReviewPrivate(f);
    const max = await db.selectFrom("reviews").select(({ fn }) => fn.max("sort_order").as("m")).executeTakeFirst();
    await db.insertInto("reviews").values({ id: newId(), private_path: name, public_path: null, alt: str(fd, "alt").slice(0, 300), sort_order: Number(max?.m ?? -1) + 1, is_published: 0, consent_checked: 0, width, height }).execute();
  } catch (e) { return fail((e as Error).message); }
  revalidatePath("/admin/reviews");
  return done("Збережено як чернетку. Перевірте дозвіл/анонімізацію перед публікацією.");
}
export async function saveReview(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id");
  const r = await db.selectFrom("reviews").selectAll().where("id", "=", id).executeTakeFirst();
  if (!r) return fail("Відгук не знайдено");
  await db.updateTable("reviews").set({ alt: str(fd, "alt").slice(0, 300), sort_order: Number(str(fd, "sort_order") || 0), consent_checked: fd.get("consent_checked") ? 1 : 0 }).where("id", "=", id).execute();
  revalidatePath("/admin/reviews"); revalidatePath("/");
  return done();
}
export async function moveReview(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id"); const dir = str(fd, "dir") === "up" ? -1 : 1;
  const all = await db.selectFrom("reviews").select(["id", "sort_order"]).orderBy("sort_order").orderBy("created_at").execute();
  const i = all.findIndex((r) => r.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return done();
  await db.updateTable("reviews").set({ sort_order: j }).where("id", "=", all[i].id).execute();
  await db.updateTable("reviews").set({ sort_order: i }).where("id", "=", all[j].id).execute();
  // нормалізація
  for (let k = 0; k < all.length; k++) if (k !== i && k !== j) await db.updateTable("reviews").set({ sort_order: k }).where("id", "=", all[k].id).execute();
  revalidatePath("/admin/reviews"); revalidatePath("/");
  return done("Порядок змінено");
}
export async function setReviewPublished(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id"); const publish = str(fd, "value") === "1";
  const r = await db.selectFrom("reviews").selectAll().where("id", "=", id).executeTakeFirst();
  if (!r) return fail("Відгук не знайдено");
  if (publish) {
    if (!r.consent_checked) return fail("Спершу позначте, що дозвіл і анонімізацію перевірено.");
    const publicPath = r.public_path ?? await publishReviewFile(r.private_path);
    await db.updateTable("reviews").set({ is_published: 1, public_path: publicPath }).where("id", "=", id).execute();
  } else {
    await unpublishReviewFile(r.public_path);
    await db.updateTable("reviews").set({ is_published: 0, public_path: null }).where("id", "=", id).execute();
  }
  revalidatePath("/admin/reviews"); revalidatePath("/");
  return done(publish ? "Опубліковано на сайті." : "Приховано з сайту.");
}
export async function deleteReview(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id");
  const r = await db.selectFrom("reviews").selectAll().where("id", "=", id).executeTakeFirst();
  if (!r) return fail("Відгук не знайдено");
  await deleteReviewFiles(r.private_path, r.public_path);
  await db.deleteFrom("reviews").where("id", "=", id).execute();
  revalidatePath("/admin/reviews"); revalidatePath("/");
  return done("Видалено.");
}

export async function updatePhoto(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id");
  const ph = await db.selectFrom("photos").select("id").where("id", "=", id).executeTakeFirst();
  if (!ph) return fail("Фото не знайдено");
  const patch: Record<string, unknown> = {};
  if (fd.has("alt")) patch.alt = str(fd, "alt").slice(0, 300);
  if (fd.has("in_gallery_set")) patch.in_gallery = str(fd, "in_gallery_set") === "1" ? 1 : 0;
  if (fd.has("sort_order")) patch.sort_order = Number(str(fd, "sort_order") || 0);
  await db.updateTable("photos").set(patch).where("id", "=", id).execute();
  revalidatePath("/admin/photos"); revalidatePath("/");
  return done();
}
export async function deletePhoto(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id");
  const ph = await db.selectFrom("photos").selectAll().where("id", "=", id).executeTakeFirst();
  if (!ph) return fail("Фото не знайдено");
  const used = await db.selectFrom("products").select("id").where("image_path", "=", ph.path).executeTakeFirst()
    ?? await db.selectFrom("categories").select("id").where("image_path", "=", ph.path).executeTakeFirst();
  if (used) return fail("Це фото використовується в каталозі. Спершу замініть його там.");
  await db.deleteFrom("photos").where("id", "=", id).execute();
  if (!ph.path.startsWith("/images/") && !ph.path.startsWith("/uploads/works/")) { try { await deletePhotoFile(ph.path); } catch {} }
  revalidatePath("/admin/photos"); revalidatePath("/");
  return done("Фото видалено.");
}
