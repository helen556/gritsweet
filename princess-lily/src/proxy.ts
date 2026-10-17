import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["uk", "en"];

/**
 * - Шляхи без префікса мови → /uk (українська за замовчуванням; Accept-Language не перебиває вибір користувача).
 * - Захисні заголовки; noindex для адмінки, оформлення, замовлень і завантажень.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  // Корінь сайту віддає українську головну без переадресації (canonical → /uk): Google бере іконку сайту
  // саме з кореневої сторінки, тож там має бути справжній HTML з <link rel="icon">.
  const root = pathname === "/";
  if (!root && !LOCALES.includes(first) && first !== "admin" && first !== "api") {
    const url = req.nextUrl.clone();
    url.pathname = `/uk${pathname}`;
    return NextResponse.redirect(url, 308); // постійно: українська — мова за замовчуванням, не залежить від браузера
  }
  const res = root ? NextResponse.rewrite(new URL("/uk", req.url)) : NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (first === "admin" || first === "api" || /^\/(uk|en)\/(checkout|order|cart|payment-unavailable)(\/|$)/.test(pathname))
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/|media/|uploads/|api/admin/upload|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)"],
};
