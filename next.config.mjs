/** @type {import('next').NextConfig} */

/**
 * Security headers applied to every response.
 *
 * The Content-Security-Policy for the payment and admin surfaces is set in
 * middleware.ts (it needs a per-request nonce); these are the headers that are
 * safe to pin statically for the whole site.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },

  // The Prisma client is generated into lib/generated and must not be bundled
  // for the browser; keeping it external also avoids tracing its engine files
  // into every serverless function.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pdf-lib", "qrcode"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Receipts and verification pages must never be cached by a shared
        // proxy — one student's receipt must not be served to another.
        source: "/(receipt|verify|payment)/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
