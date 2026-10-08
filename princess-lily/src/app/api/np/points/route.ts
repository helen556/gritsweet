import { searchPoints } from "@/lib/delivery/nova-poshta";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  if (!(await rateLimit("np", 120, 600))) return Response.json({ items: [] }, { status: 429 });
  const u = new URL(req.url).searchParams;
  try { return Response.json({ items: await searchPoints(u.get("city") ?? "", (u.get("q") ?? "").slice(0, 60)) }); } catch { return Response.json({ items: [] }); }
}
