import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy for the payment and administration surfaces.
 *
 * A fresh nonce is minted per request and handed to Next.js, which stamps it on
 * the scripts and styles it injects. Combined with `strict-dynamic`, that means
 * an injected `<script>` — the payload of a stored-XSS attempt through, say, a
 * student's name — cannot execute, because it will not carry the nonce.
 *
 * The directives follow the pattern in
 * `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.
 * Deliberately absent from `script-src`: `https:` and `'unsafe-inline'`. Those
 * are the customary fallback for browsers that predate `strict-dynamic`, and
 * every browser Next 16 supports (Chrome/Edge/Firefox 111+, Safari 16.4+)
 * honours it — so they would only ever weaken the policy.
 *
 * The marketing landing page at `/` is excluded so it can stay statically
 * rendered; it takes no user input and gets its headers from next.config.mjs.
 *
 * (Next 16 renamed this file convention from `middleware` to `proxy`, and the
 * proxy always runs on the Node.js runtime.)
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";

  const csp = [
    `default-src 'self'`,
    // React's development build uses eval to rebuild server stack traces in the
    // browser. Production never does, so the allowance stops at development.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Next stamps the same nonce on the styles it generates; every other
    // stylesheet in this app is a first-party file.
    `style-src 'self' 'nonce-${nonce}'`,
    // data: covers the QR code rendered inline on the receipt page.
    `img-src 'self' data: https://images.unsplash.com`,
    `font-src 'self' data:`,
    // The dev server's hot-reload socket; absent from a production build.
    `connect-src 'self'${isDevelopment ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * Everything that renders student or administrative data. Static assets, the
 * image optimiser and the landing page are deliberately excluded.
 *
 * Prefetches are excluded too: a prefetched response would be cached carrying
 * the nonce of the prefetch request, which no longer matches the CSP header of
 * the navigation that eventually uses it.
 *
 * The `missing` conditions are repeated literally rather than shared through a
 * constant — matcher values must be statically analysable at build time, and a
 * variable would be silently ignored.
 */
export const config = {
  matcher: [
    {
      source: "/pay/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/payment/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/receipt/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/verify/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/admin/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
