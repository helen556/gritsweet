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

/** Фото книжок для атмосферного блоку: налаштування books_photo (завантаження в адмінці) або файл з пакета; немає — блок прихований. */
export async function getBooksPhoto(): Promise<Photo | null> {
  const v = (await getSettings()).books_photo;
  if (v === "none") return null;
  if (v) { try { return JSON.parse(v) as Photo; } catch { /* падаємо на типове */ } }
  const m = (manifest as Record<string, { width: number; height: number; widths: number[] } | undefined>)["books-table"];
  return m ? { base: "/media/books-table", widths: m.widths, width: m.width, height: m.height } : null;
}
