import "server-only";
import sharp, { type Metadata } from "sharp";
import { db } from "@/db";

export const MAX_IMG = 10 * 1024 * 1024;
export type StoredImage = { base: string; widths: number[]; width: number; height: number };

/**
 * Перекодування зображення (JPG/PNG/WebP, до 10 МБ) в AVIF+WebP кількох ширин без метаданих; поворот за EXIF.
 * Результат зберігається в БД (public_files) і віддається маршрутом /uploads/… — диск Vercel тимчасовий,
 * тож файли на ньому зникали б після перезапуску.
 */
export async function storeImage(buf: Buffer, name: string, targetWidths: number[]): Promise<StoredImage | { error: string }> {
  if (buf.length > MAX_IMG) return { error: "Зображення до 10 МБ" };
  let meta: Metadata;
  try { meta = await sharp(buf).metadata(); } catch { return { error: "Непідтримуваний формат зображення" }; }
  if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) return { error: "Лише JPG, PNG або WebP" };
  const rotated = await sharp(buf).rotate().toBuffer({ resolveWithObject: true });
  const W = rotated.info.width, H = rotated.info.height;
  const base = `${name.toLowerCase().replace(/[^a-z0-9_-]/g, "")}-${Date.now().toString(36)}`;
  const widths = targetWidths.filter((w) => w <= W);
  if (!widths.length) widths.push(W);
  const now = new Date().toISOString();
  for (const w of widths) {
    const avif = await sharp(rotated.data).resize({ width: w }).avif({ quality: 60 }).toBuffer();
    const webp = await sharp(rotated.data).resize({ width: w }).webp({ quality: 82 }).toBuffer();
    await db.insertInto("public_files").values([
      { path: `covers/${base}-${w}.avif`, content_type: "image/avif", data_b64: avif.toString("base64"), created_at: now },
      { path: `covers/${base}-${w}.webp`, content_type: "image/webp", data_b64: webp.toString("base64"), created_at: now },
    ]).execute();
  }
  return { base: `/uploads/covers/${base}`, widths, width: W, height: H };
}
