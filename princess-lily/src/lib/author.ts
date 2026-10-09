import "server-only";
import { getSettings } from "./settings";
import manifest from "./media-manifest.json";

export type Photo = { base: string; widths: number[]; width: number; height: number };

/**
 * Необов'язкове поле authorPhoto. Налаштування `author_photo`:
 *   ""     → надане фото з пакета (/media/author-liza)
 *   "none" → блок авторки без фото
 *   JSON   → фото, завантажене в адмінці
 * Фото авторки ніколи не підміняється ілюстрацією Лілі.
 */
export async function getAuthorPhoto(): Promise<Photo | null> {
  const v = (await getSettings()).author_photo;
  if (v === "none") return null;
  if (v) { try { return JSON.parse(v) as Photo; } catch { /* падаємо на типове */ } }
  const m = manifest["author-liza"];
  return { base: "/media/author-liza", widths: m.widths, width: m.width, height: m.height };
}
