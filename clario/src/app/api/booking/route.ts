import { NextResponse } from "next/server";
import { bookingSchema, validateBooking } from "@/lib/booking";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field
  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const invalid = validateBooking(body);
  if (invalid.length) return NextResponse.json({ ok: false, invalid }, { status: 422 });

  const booking = bookingSchema.parse(body);
  // TODO: deliver the request to the clinic (CRM, email or messenger integration).
  console.info("[booking]", { service: booking.service, date: booking.date || null, lang: booking.lang });

  return NextResponse.json({ ok: true });
}
