import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["uk", "en"];

/**
 * - Шляхи без префікса мови → /uk (українська за замовчуванням; Accept-Language не перебиває вибір користувача).
 * - Захисні заголовки; noindex для адмінки, оформлення, замовлень і завантажень.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (!LOCALES.includes(first) && first !== "admin" && first !== "api") {
    const url = req.nextUrl.clone();
    url.pathname = `/uk${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url, pathname === "/" ? 307 : 308);
  }
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (first === "admin" || first === "api" || /^\/(uk|en)\/(checkout|order|cart|payment-unavailable)(\/|$)/.test(pathname))
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/|media/|uploads/|api/admin/upload|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
