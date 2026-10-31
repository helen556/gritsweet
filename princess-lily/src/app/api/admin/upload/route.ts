import { db } from "@/db";
import { getAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { privateStorage } from "@/lib/storage";
import { randomBytes } from "node:crypto";
import { setSetting } from "@/lib/settings";
import { saveReceipt } from "@/lib/receipts";
import { newId } from "@/lib/ids";
import { storeImage, MAX_IMG } from "@/lib/images";

const MAX_PDF = 100 * 1024 * 1024;
/** Розмір частини великого PDF (з запасом під ліміт тіла запиту Vercel ~4,5 МБ). */
const CHUNK = 3 * 1024 * 1024;

/** Перевіряє PDF і прив'язує його до PDF-варіанта книжки (старий файл видаляється). */
async function storeBookPdf(admin: { id: string; email: string }, variantId: string, buf: Buffer) {
  if (buf.length > MAX_PDF) return err("PDF до 100 МБ");
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return err("Це не PDF-файл");
  const v = await db.selectFrom("product_variants").select(["id", "product_id", "format", "private_pdf_key"]).where("id", "=", variantId).executeTakeFirst();
  if (!v || v.format !== "pdf") return err("Варіант не знайдено");
  const key = `pdf/${v.id.toLowerCase().replace(/[^a-z0-9_-]/g, "")}-${randomBytes(8).toString("hex")}.pdf`;
  await privateStorage().put(key, buf, "application/pdf");
  await db.updateTable("product_variants").set({ private_pdf_key: key, updated_at: new Date().toISOString() }).where("id", "=", v.id).execute();
  if (v.private_pdf_key) await privateStorage().remove(v.private_pdf_key).catch(() => {});
  await audit(admin, "variant.pdf_upload", "variant", v.id, { bytes: buf.length });
  return Response.json({ ok: true, bytes: buf.length });
}
const COVER_WIDTHS = [360, 640, 960, 1254];
const err = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Завантаження для адмінки. Автентифікація й роль перевіряються тут (не лише прихованою кнопкою),
 * Origin має збігатися з хостом (захист від CSRF), розмір і тип файлу перевіряються за вмістом.
 * PDF → приватне сховище (не public). Обкладинка → перекодування sharp (без метаданих), зберігається в БД.
 */
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return err("Потрібен вхід", 401);
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (!origin || new URL(origin).host !== host) return err("Заборонено", 403);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (!len || len > MAX_PDF + 1024 * 64) return err("Файл завеликий", 413);
  const fd = await req.formData();
  const kind = String(fd.get("kind")), id = String(fd.get("id") ?? "").slice(0, 64);
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return err("Оберіть файл");
  const buf = Buffer.from(await file.arrayBuffer());

  if (kind === "pdf") {
    if (admin.role !== "owner") return err("Лише власниця може завантажувати файли книжок", 403);
    return storeBookPdf(admin, id, buf);
  }
  if (kind === "pdf_chunk") {
    // Частина великого PDF (≤ CHUNK): на Vercel тіло запиту обмежене ~4,5 МБ, тому файл приходить шматками
    if (admin.role !== "owner") return err("Лише власниця може завантажувати файли книжок", 403);
    const upload = String(fd.get("upload") ?? ""), idx = Number(fd.get("index")), total = Number(fd.get("total"));
    if (!/^[a-f0-9]{16,32}$/.test(upload) || !Number.isInteger(idx) || !Number.isInteger(total) || total < 1 || total > Math.ceil(MAX_PDF / (3 * 1024 * 1024)) || idx < 0 || idx >= total) return err("Невірна частина файлу");
    if (buf.length > CHUNK) return err("Частина завелика");
    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    if (idx === 0) await db.deleteFrom("upload_chunks").where("created_at", "<", cutoff).execute(); // недокачані спроби
    const row = { upload_id: upload, idx, data_b64: buf.toString("base64"), created_at: new Date().toISOString() };
    await db.insertInto("upload_chunks").values(row).onConflict((oc) => oc.columns(["upload_id", "idx"]).doUpdateSet(row)).execute();
    if (idx < total - 1) return Response.json({ ok: true, received: idx + 1 });
    const parts = await db.selectFrom("upload_chunks").select(["idx", "data_b64"]).where("upload_id", "=", upload).orderBy("idx").execute();
    await db.deleteFrom("upload_chunks").where("upload_id", "=", upload).execute();
    if (parts.length !== total || parts.some((p, i) => p.idx !== i)) return err("Файл прийшов не повністю — спробуйте ще раз");
    return storeBookPdf(admin, id, Buffer.concat(parts.map((p) => Buffer.from(p.data_b64, "base64"))));
  }
  if (kind === "cover") {
    // id = товар; locale = "" (загальна обкладинка) або "uk"/"en" (обкладинка мовної версії)
    const locale = String(fd.get("locale") ?? "");
    if (locale && locale !== "uk" && locale !== "en") return err("Невірна мова");
    const p = await db.selectFrom("products").select("id").where("id", "=", id).executeTakeFirst();
    if (!p) return err("Товар не знайдено");
    const img = await storeImage(buf, `${p.id}${locale ? `-${locale}` : ""}`, COVER_WIDTHS);
    if ("error" in img) return err(img.error);
    if (locale) {
      const t = await db.selectFrom("product_translations").select("locale").where("product_id", "=", p.id).where("locale", "=", locale as "uk" | "en").executeTakeFirst();
      if (!t) return err("Спершу збережіть назву цією мовою");
      await db.updateTable("product_translations").set({ cover_base: img.base, cover_widths: JSON.stringify(img.widths), cover_width: img.width, cover_height: img.height })
        .where("product_id", "=", p.id).where("locale", "=", locale as "uk" | "en").execute();
    } else {
      await db.updateTable("products").set({ cover_base: img.base, cover_widths: JSON.stringify(img.widths), cover_width: img.width, cover_height: img.height, updated_at: new Date().toISOString() }).where("id", "=", p.id).execute();
    }
    await audit(admin, "product.cover_upload", "product", p.id, { locale: locale || "all" });
    return Response.json({ ok: true });
  }
  if (kind === "spread") {
    // Справжній розворот книжки (для «Книжка зсередини»); locale порожній — для обох мов
    const locale = String(fd.get("locale") ?? "");
    const p = await db.selectFrom("products").select("id").where("id", "=", id).executeTakeFirst();
    if (!p) return err("Товар не знайдено");
    const img = await storeImage(buf, `${p.id}-spread`, [640, 1280, 1920]);
    if ("error" in img) return err(img.error);
    const n = await db.selectFrom("product_images").select(({ fn }) => fn.countAll<number>().as("n")).where("product_id", "=", p.id).executeTakeFirst();
    await db.insertInto("product_images").values({
      id: newId("img"), product_id: p.id, kind: "spread", locale: locale === "uk" || locale === "en" ? locale : null,
      base: img.base, widths: JSON.stringify(img.widths), width: img.width, height: img.height,
      alt_uk: String(fd.get("alt_uk") ?? "").slice(0, 200), alt_en: String(fd.get("alt_en") ?? "").slice(0, 200),
      sort_order: Number(n?.n ?? 0) + 1, created_at: new Date().toISOString(),
    }).execute();
    await audit(admin, "product.spread_upload", "product", p.id);
    return Response.json({ ok: true });
  }
  if (kind === "books_photo") {
    // Фото книжок (атмосферний блок на головній) — лише власниця
    if (admin.role !== "owner") return err("Лише власниця", 403);
    const img = await storeImage(buf, "books-photo", [640, 1024, 1600, 2200]);
    if ("error" in img) return err(img.error);
    await setSetting("books_photo", JSON.stringify(img));
    await audit(admin, "settings.books_photo_upload", "settings");
    return Response.json({ ok: true });
  }
  if (kind === "receipt") {
    const o = await db.selectFrom("orders").select("id").where("id", "=", id).executeTakeFirst();
    if (!o) return err("Замовлення не знайдено");
    const r = await saveReceipt(o.id, buf, file.name, admin.email, MAX_IMG);
    if (!r.ok) return err(r.error === "type" ? "Лише PDF, JPG, PNG або WebP" : r.error === "limit" ? "Забагато квитанцій" : "Файл до 10 МБ");
    await audit(admin, "receipt.upload", "order", o.id);
    return Response.json({ ok: true });
  }
  if (kind === "author") {
    // Необов'язкове фото авторки (authorPhoto): лише власниця; перекодування без метаданих
    if (admin.role !== "owner") return err("Лише власниця може змінювати фото авторки", 403);
    const img = await storeImage(buf, "author", [480, 800, 1200]);
    if ("error" in img) return err(img.error);
    await setSetting("author_photo", JSON.stringify(img));
    await audit(admin, "settings.author_photo_upload", "settings");
    return Response.json({ ok: true });
  }
  return err("Невідомий тип");
}
