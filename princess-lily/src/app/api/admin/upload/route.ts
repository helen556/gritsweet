import sharp, { type Metadata } from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { getAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { privateStorage } from "@/lib/storage";
import { randomBytes } from "node:crypto";
import { setSetting } from "@/lib/settings";
import { saveReceipt } from "@/lib/receipts";

const MAX_PDF = 100 * 1024 * 1024, MAX_IMG = 10 * 1024 * 1024;
const COVER_WIDTHS = [360, 640, 960, 1254];
const err = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Завантаження для адмінки. Автентифікація й роль перевіряються тут (не лише прихованою кнопкою),
 * Origin має збігатися з хостом (захист від CSRF), розмір і тип файлу перевіряються за вмістом.
 * PDF → приватне сховище (не public). Обкладинка → перекодування sharp (без метаданих) у UPLOADS_DIR.
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
    if (buf.length > MAX_PDF) return err("PDF до 100 МБ");
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return err("Це не PDF-файл");
    const v = await db.selectFrom("product_variants").select(["id", "product_id", "format", "private_pdf_key"]).where("id", "=", id).executeTakeFirst();
    if (!v || v.format !== "pdf") return err("Варіант не знайдено");
    const key = `pdf/${v.id.toLowerCase().replace(/[^a-z0-9_-]/g, "")}-${randomBytes(8).toString("hex")}.pdf`;
    await privateStorage().put(key, buf, "application/pdf");
    await db.updateTable("product_variants").set({ private_pdf_key: key, updated_at: new Date().toISOString() }).where("id", "=", v.id).execute();
    if (v.private_pdf_key) await privateStorage().remove(v.private_pdf_key).catch(() => {});
    await audit(admin, "variant.pdf_upload", "variant", v.id, { bytes: buf.length });
    return Response.json({ ok: true });
  }
  if (kind === "cover") {
    if (buf.length > MAX_IMG) return err("Зображення до 10 МБ");
    const p = await db.selectFrom("products").select("id").where("id", "=", id).executeTakeFirst();
    if (!p) return err("Товар не знайдено");
    let meta: Metadata;
    try { meta = await sharp(buf).metadata(); } catch { return err("Непідтримуваний формат зображення"); }
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) return err("Лише JPG, PNG або WebP");
    const dir = path.resolve(process.env.UPLOADS_DIR ?? "storage/uploads", "covers");
    await fs.mkdir(dir, { recursive: true });
    const base = `${p.id.toLowerCase().replace(/[^a-z0-9_-]/g, "")}-${Date.now().toString(36)}`;
    const widths = COVER_WIDTHS.filter((w) => w <= meta.width!);
    if (!widths.length) widths.push(meta.width);
    for (const w of widths) {
      await sharp(buf).rotate().resize({ width: w }).avif({ quality: 55 }).toFile(path.join(dir, `${base}-${w}.avif`));
      await sharp(buf).rotate().resize({ width: w }).webp({ quality: 78 }).toFile(path.join(dir, `${base}-${w}.webp`));
    }
    await db.updateTable("products").set({ cover_base: `/uploads/covers/${base}`, cover_widths: JSON.stringify(widths), cover_width: meta.width, cover_height: meta.height, updated_at: new Date().toISOString() }).where("id", "=", p.id).execute();
    await audit(admin, "product.cover_upload", "product", p.id);
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
    if (buf.length > MAX_IMG) return err("Зображення до 10 МБ");
    let meta: Metadata;
    try { meta = await sharp(buf).rotate().metadata(); } catch { return err("Непідтримуваний формат зображення"); }
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) return err("Лише JPG, PNG або WebP");
    const dir = path.resolve(process.env.UPLOADS_DIR ?? "storage/uploads", "covers");
    await fs.mkdir(dir, { recursive: true });
    const base = `author-${Date.now().toString(36)}`;
    const rotated = await sharp(buf).rotate().toBuffer({ resolveWithObject: true });
    const W = rotated.info.width, H = rotated.info.height;
    const widths = [480, 800, 1200].filter((w) => w <= W);
    if (!widths.length) widths.push(W);
    for (const w of widths) {
      await sharp(rotated.data).resize({ width: w }).avif({ quality: 60 }).toFile(path.join(dir, `${base}-${w}.avif`));
      await sharp(rotated.data).resize({ width: w }).webp({ quality: 80 }).toFile(path.join(dir, `${base}-${w}.webp`));
    }
    await setSetting("author_photo", JSON.stringify({ base: `/uploads/covers/${base}`, widths, width: W, height: H }));
    await audit(admin, "settings.author_photo_upload", "settings");
    return Response.json({ ok: true });
  }
  return err("Невідомий тип");
}
