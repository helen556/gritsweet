import "server-only";
import sharp from "sharp";
import { newId } from "./ids";
import { deletePrivate, deletePublic, getPrivate, putPrivate, putPublic } from "./storage";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Перевіряє тип і розмір, перекодовує у WebP (прибирає метадані). */
async function toWebp(file: File, maxWidth: number): Promise<{ data: Buffer; width: number; height: number }> {
  if (!ALLOWED.has(file.type)) throw new Error("Дозволені лише зображення JPG, PNG, WebP або HEIC.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Файл завеликий: до 5 МБ.");
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const out = await sharp(buf, { failOn: "error" }).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    return { data: out.data, width: out.info.width, height: out.info.height };
  } catch { throw new Error("Не вдалося прочитати зображення."); }
}
const safeName = (n: string) => /^[A-Za-z0-9_-]+\.webp$/.test(n);

// ---- Референси клієнтів (приватно) ----
export async function saveReference(file: File): Promise<string> {
  const { data } = await toWebp(file, 1600);
  const name = `${newId()}.webp`;
  await putPrivate(`references/${name}`, data);
  return name;
}
export async function readReference(name: string): Promise<Buffer | null> {
  if (!safeName(name)) return null;
  return getPrivate(`references/${name}`);
}

// ---- Фото товарів / галерея (публічно) ----
export async function saveProductPhoto(file: File): Promise<{ path: string; width: number | null; height: number | null }> {
  const { data, width, height } = await toWebp(file, 1800);
  const path = await putPublic(`photos/${newId()}.webp`, data);
  return { path, width, height };
}
export async function deletePhotoFile(publicPath: string) { await deletePublic(publicPath); }

// ---- Відгуки ----
export async function saveReviewPrivate(file: File): Promise<{ name: string; width: number; height: number }> {
  const { data, width, height } = await toWebp(file, 1200);
  const name = `${newId()}.webp`;
  await putPrivate(`reviews/${name}`, data);
  return { name, width, height };
}
export async function readReviewPrivate(name: string): Promise<Buffer | null> {
  if (!safeName(name)) return null;
  return getPrivate(`reviews/${name}`);
}
/** Публікація: копіює приватний файл у публічне сховище. Повертає публічний шлях/URL. */
export async function publishReviewFile(name: string): Promise<string> {
  if (!safeName(name)) throw new Error("bad name");
  const buf = await getPrivate(`reviews/${name}`);
  if (!buf) throw new Error("Оригінал відгуку не знайдено у сховищі. Завантажте файл ще раз.");
  return putPublic(`reviews/${name}`, buf);
}
export async function unpublishReviewFile(publicPath: string | null) {
  if (publicPath) await deletePublic(publicPath);
}
export async function deleteReviewFiles(name: string, publicPath: string | null) {
  if (publicPath) await deletePublic(publicPath);
  await deletePrivate(`reviews/${name}`);
}
