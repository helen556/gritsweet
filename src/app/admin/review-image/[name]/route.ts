import { getSession } from "@/lib/auth";
import { readReviewPrivate } from "@/lib/uploads";

// Попередній перегляд оригіналів відгуків — лише для адміністратора.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const { name } = await params;
  const buf = await readReviewPrivate(name);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
}
