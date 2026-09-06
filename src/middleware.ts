import { NextResponse, type NextRequest } from "next/server";

// Передаємо шлях у layout і додаємо базові захисні заголовки.
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-pathname", req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: h } });
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.nextUrl.pathname.startsWith("/admin")) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
export const config = { matcher: ["/((?!_next|images|uploads|favicon.ico).*)"] };
