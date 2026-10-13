import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";

/** Публічні завантаження адмінки (лише перекодовані обкладинки й фото). Зберігаються в БД (public_files); public/ фіксується при збірці. */
const TYPES: Record<string, string> = { ".avif": "image/avif", ".webp": "image/webp" };

export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (!/^covers\/[a-z0-9_-]+-\d+\.(avif|webp)$/.test(rel)) return new Response("Not found", { status: 404 });
  const headers = (type: string) => ({ "content-type": type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" });
  const row = await db.selectFrom("public_files").select(["content_type", "data_b64"]).where("path", "=", rel).executeTakeFirst();
  if (row) return new Response(new Uint8Array(Buffer.from(row.data_b64, "base64")), { headers: headers(row.content_type) });
  // давні завантаження на диск (локальний сервер)
  const root = path.resolve(process.env.UPLOADS_DIR ?? "storage/uploads");
  try {
    const data = await fs.readFile(path.join(root, rel));
    return new Response(new Uint8Array(data), { headers: { "content-type": TYPES[path.extname(rel)], "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
