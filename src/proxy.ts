import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Site-wide password gate (HTTP Basic Auth). Active ONLY when SITE_PASSWORD is
 * set — so local dev is open, but the deployed site (which carries real, non-
 * consented demo data) is never publicly accessible or indexable.
 *
 * Any username is accepted; only the password must match. Note: server actions
 * additionally validate their own page_token, so data mutations stay protected
 * even independent of this gate (see Next "proxy" docs on Server Functions).
 */
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next(); // gate disabled

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const provided = decoded.slice(decoded.indexOf(":") + 1);
    if (provided === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="afterparty.digital", charset="UTF-8"' },
  });
}

export const config = {
  // Gate everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
