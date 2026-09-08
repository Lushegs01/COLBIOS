import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy for the payment and administration surfaces.
 *
 * A fresh nonce is minted per request and handed to Next.js, which stamps it on
 * the scripts it injects. Combined with `strict-dynamic`, that means an
 * injected `<script>` — the payload of a stored-XSS attempt through, say, a
 * student's name — cannot execute, because it will not carry the nonce.
 *
 * The marketing landing page at `/` is excluded so it can stay statically
 * rendered; it takes no user input and gets its headers from next.config.mjs.
 *
 * (Next 16 renamed this file convention from `middleware` to `proxy`.)
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV !== "production";

  const csp = [
    `default-src 'self'`,
    // `strict-dynamic` is what actually enforces the policy in modern browsers;
    // `https:` and `'unsafe-inline'` are ignored where it is supported and act
    // as the fallback for older ones. React's development build needs eval, and
    // production never does — so that allowance is scoped to development.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    // Inline style *attributes* are used for chart bar widths; stylesheets are
    // all first-party files.
    `style-src 'self' 'unsafe-inline'`,
    // data: covers the QR code rendered inline on the receipt page.
    `img-src 'self' data: https://images.unsplash.com`,
    `font-src 'self' data:`,
    // The dev server's hot-reload socket; absent from a production build.
    `connect-src 'self'${isDevelopment ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /**
     * Everything that renders student or administrative data. Static assets,
     * the image optimiser and the landing page are deliberately excluded.
     */
    "/pay/:path*",
    "/payment/:path*",
    "/receipt/:path*",
    "/verify/:path*",
    "/admin/:path*",
  ],
};
