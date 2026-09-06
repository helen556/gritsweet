import "server-only";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

/**
 * Сховище файлів. Якщо задано SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY — Supabase Storage
 * (бакети `public` та `private`), інакше — локальний диск (розробка).
 * Ключі: "photos/<name>", "reviews/<name>", "references/<name>".
 */
const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET ?? "public";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET ?? "private";
const LOCAL_PUBLIC = path.resolve("public/uploads");
const LOCAL_PRIVATE = path.resolve(process.env.PRIVATE_STORAGE_DIR ?? "storage/private");

export const usingSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function client() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
const safeKey = (k: string) => /^[a-z]+\/[A-Za-z0-9_-]+\.webp$/.test(k);

export async function ensureBuckets() {
  if (!usingSupabase) return;
  const sb = client();
  const { data } = await sb.storage.listBuckets();
  const names = new Set((data ?? []).map((b) => b.name));
  if (!names.has(PUBLIC_BUCKET)) await sb.storage.createBucket(PUBLIC_BUCKET, { public: true, fileSizeLimit: 10 * 1024 * 1024 });
  if (!names.has(PRIVATE_BUCKET)) await sb.storage.createBucket(PRIVATE_BUCKET, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
}

/** Публічний файл → повертає URL для <img>. */
export async function putPublic(key: string, buf: Buffer, contentType = "image/webp"): Promise<string> {
  if (!safeKey(key)) throw new Error("bad key");
  if (usingSupabase) {
    const { error } = await client().storage.from(PUBLIC_BUCKET).upload(key, buf, { contentType, upsert: true });
    if (error) throw new Error("Не вдалося зберегти файл у сховище: " + error.message);
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${key}`;
  }
  const p = path.join(LOCAL_PUBLIC, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
  return `/uploads/${key}`;
}
export async function putPrivate(key: string, buf: Buffer, contentType = "image/webp"): Promise<void> {
  if (!safeKey(key)) throw new Error("bad key");
  if (usingSupabase) {
    const { error } = await client().storage.from(PRIVATE_BUCKET).upload(key, buf, { contentType, upsert: true });
    if (error) throw new Error("Не вдалося зберегти файл у сховище: " + error.message);
    return;
  }
  const p = path.join(LOCAL_PRIVATE, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
}
export async function getPrivate(key: string): Promise<Buffer | null> {
  if (!safeKey(key)) return null;
  if (usingSupabase) {
    const { data, error } = await client().storage.from(PRIVATE_BUCKET).download(key);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  try { return await fs.readFile(path.join(LOCAL_PRIVATE, key)); } catch { return null; }
}
export async function deletePublic(publicPathOrUrl: string) {
  if (usingSupabase) {
    const marker = `/object/public/${PUBLIC_BUCKET}/`;
    const i = publicPathOrUrl.indexOf(marker);
    if (i < 0) return;
    await client().storage.from(PUBLIC_BUCKET).remove([publicPathOrUrl.slice(i + marker.length)]);
    return;
  }
  if (!publicPathOrUrl.startsWith("/uploads/")) return;
  const p = path.join(LOCAL_PUBLIC, publicPathOrUrl.slice("/uploads/".length));
  if (fsSync.existsSync(p)) await fs.unlink(p);
}
export async function deletePrivate(key: string) {
  if (!safeKey(key)) return;
  if (usingSupabase) { await client().storage.from(PRIVATE_BUCKET).remove([key]); return; }
  const p = path.join(LOCAL_PRIVATE, key);
  if (fsSync.existsSync(p)) await fs.unlink(p);
}
