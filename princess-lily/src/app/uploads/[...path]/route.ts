import fs from "node:fs/promises";
import path from "node:path";

/** Публічні завантаження адмінки (лише перекодовані обкладинки). Файли поза public/, бо public фіксується при збірці. */
const TYPES: Record<string, string> = { ".avif": "image/avif", ".webp": "image/webp" };

export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (!/^covers\/[a-z0-9_-]+-\d+\.(avif|webp)$/.test(rel)) return new Response("Not found", { status: 404 });
  const root = path.resolve(process.env.UPLOADS_DIR ?? "storage/uploads");
  try {
    const data = await fs.readFile(path.join(root, rel));
    return new Response(new Uint8Array(data), { headers: { "content-type": TYPES[path.extname(rel)], "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
