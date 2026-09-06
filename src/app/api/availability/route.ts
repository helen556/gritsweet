import { NextResponse } from "next/server";
import { getPublicClosedDates } from "@/lib/calendar";
import { todayKyiv } from "@/lib/dates";
import { isIsoDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";

// Публічно: лише список закритих дат у діапазоні, сьогоднішня дата за Києвом і рекомендований термін.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = u.searchParams.get("from") ?? todayKyiv();
  const to = u.searchParams.get("to") ?? from;
  if (!isIsoDate(from) || !isIsoDate(to)) return NextResponse.json({ error: "bad range" }, { status: 400 });
  const closed = await getPublicClosedDates(from, to);
  const s = await getSettings();
  return NextResponse.json({ today: todayKyiv(), closed, leadDays: Number(s.lead_days || 7) }, { headers: { "Cache-Control": "no-store" } });
}
