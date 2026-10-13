import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";

/**
 * Приватне сховище для куплених PDF і квитанцій. НІКОЛИ не в public/.
 *   PRIVATE_STORAGE=local    → тека PRIVATE_STORAGE_DIR (за замовч. ./storage/private), потрібен постійний диск
 *   PRIVATE_STORAGE=supabase → приватний bucket Supabase Storage (service role key лише на сервері);
 *                              якщо Supabase відхиляє запис (напр. неправильний ключ) — файл зберігається в БД
 *   PRIVATE_STORAGE=database → таблиця private_files (для невеликих файлів: квитанції до ~4 МБ)
 */
export interface PrivateStorage {
  kind: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^(pdf\/[a-z0-9_-]{1,120}\.pdf|receipts\/[a-z0-9_-]{1,64}\/[a-z0-9_-]{1,64}\.(pdf|jpg|png|webp))$/;
export function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Невірний ключ файлу");
}

function local(): PrivateStorage {
  const root = path.resolve(process.env.PRIVATE_STORAGE_DIR ?? "storage/private");
  const full = (key: string) => { assertKey(key); return path.join(root, key); };
  return {
    kind: "local",
    async put(key, data) { const f = full(key); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, data, { mode: 0o600 }); },
    async get(key) { try { return await fs.readFile(full(key)); } catch { return null; } },
    async remove(key) { await fs.rm(full(key), { force: true }); },
  };
}

function supabase(): PrivateStorage {
  const url = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  // Новий формат ключів Supabase (sb_secret_…) — не JWT: передається лише в заголовку apikey.
  // Старий service_role JWT (три частини через крапку) — ще й як Bearer.
  const keyH: Record<string, string> = key.split(".").length === 3 ? { Authorization: `Bearer ${key}`, apikey: key } : { apikey: key };
  const bucket = process.env.SUPABASE_PRIVATE_BUCKET ?? "private-books";
  const obj = (key: string) => { assertKey(key); return `${url}/storage/v1/object/${bucket}/${key}`; };
  return {
    kind: "supabase",
    async put(key, data, contentType) {
      const r = await fetch(obj(key), { method: "POST", headers: { ...keyH, "content-type": contentType, "x-upsert": "true" }, body: new Uint8Array(data) });
      if (!r.ok) throw new Error(`Supabase upload: ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
    },
    async get(key) {
      const r = await fetch(obj(key), { headers: keyH });
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    },
    async remove(key) { await fetch(`${url}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { ...keyH, "content-type": "application/json" }, body: JSON.stringify({ prefixes: [key] }) }); },
  };
}

function database(): PrivateStorage {
  return {
    kind: "database",
    async put(key, data, contentType) {
      assertKey(key);
      const row = { key, content_type: contentType, size_bytes: data.length, data_b64: data.toString("base64"), created_at: new Date().toISOString() };
      await db.insertInto("private_files").values(row).onConflict((oc) => oc.column("key").doUpdateSet(row)).execute();
    },
    async get(key) {
      assertKey(key);
      const r = await db.selectFrom("private_files").select("data_b64").where("key", "=", key).executeTakeFirst();
      return r ? Buffer.from(r.data_b64, "base64") : null;
    },
    async remove(key) { assertKey(key); await db.deleteFrom("private_files").where("key", "=", key).execute(); },
  };
}

/** Supabase, а при помилці запису — БД: квитанція покупця не губиться через неправильно налаштований ключ сховища. */
function withDbFallback(primary: PrivateStorage): PrivateStorage {
  const fallback = database();
  return {
    kind: `${primary.kind}+database`,
    async put(key, data, contentType) {
      try { await primary.put(key, data, contentType); }
      catch (e) { console.error(`private storage (${primary.kind}) failed, saving to database:`, e); await fallback.put(key, data, contentType); }
    },
    async get(key) { return (await fallback.get(key)) ?? (await primary.get(key)); },
    async remove(key) { await fallback.remove(key); await primary.remove(key); },
  };
}

export function privateStorage(): PrivateStorage {
  if (process.env.PRIVATE_STORAGE === "supabase" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return withDbFallback(supabase());
  if (process.env.PRIVATE_STORAGE === "database" || process.env.VERCEL) return database();
  return local();
}
