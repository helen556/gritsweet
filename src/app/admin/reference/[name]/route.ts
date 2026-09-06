import { getSession } from "@/lib/auth";
import { readReference } from "@/lib/uploads";

// Референси клієнтів віддаються лише авторизованому адміністратору.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const { name } = await params;
  const buf = await readReference(name);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
}
