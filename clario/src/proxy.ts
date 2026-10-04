import { NextResponse, type NextRequest } from "next/server";

// Ukrainian is served from the root ("/"), English from "/en".
// Internally every page lives under app/[lang], so root paths are rewritten to /uk.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/en" || pathname.startsWith("/en/")) return NextResponse.next();

  // Keep a single public URL for Ukrainian pages
  if (pathname === "/uk" || pathname.startsWith("/uk/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/uk${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|media|.*\\..*).*)"],
};
