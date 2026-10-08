import { searchCities } from "@/lib/delivery/nova-poshta";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  if (!(await rateLimit("np", 120, 600))) return Response.json({ items: [] }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  try { return Response.json({ items: await searchCities(q) }); } catch { return Response.json({ items: [] }); }
}
