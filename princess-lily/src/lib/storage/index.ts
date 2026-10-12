import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Приватне сховище для куплених PDF і квитанцій. НІКОЛИ не в public/.
 *   PRIVATE_STORAGE=local    → тека PRIVATE_STORAGE_DIR (за замовч. ./storage/private), потрібен постійний диск
 *   PRIVATE_STORAGE=supabase → приватний bucket Supabase Storage (service role key лише на сервері)
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
  const keyH = { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY! };
  const bucket = process.env.SUPABASE_PRIVATE_BUCKET ?? "private-books";
  const obj = (key: string) => { assertKey(key); return `${url}/storage/v1/object/${bucket}/${key}`; };
  return {
    kind: "supabase",
    async put(key, data, contentType) {
      const r = await fetch(obj(key), { method: "POST", headers: { ...keyH, "content-type": contentType, "x-upsert": "true" }, body: new Uint8Array(data) });
      if (!r.ok) throw new Error(`Supabase upload: ${r.status}`);
    },
    async get(key) {
      const r = await fetch(obj(key), { headers: keyH });
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    },
    async remove(key) { await fetch(`${url}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { ...keyH, "content-type": "application/json" }, body: JSON.stringify({ prefixes: [key] }) }); },
  };
}

export function privateStorage(): PrivateStorage {
  if (process.env.PRIVATE_STORAGE === "supabase" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return supabase();
  return local();
}
