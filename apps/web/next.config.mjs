/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

/* Baseline security headers. The app holds a Supabase session in the browser
 * and renders tenant data, so clickjacking protection is not optional.
 * Notes:
 *  - HSTS is production-only: browsers ignore it over plaintext localhost, and
 *    gating it avoids surprising a future http staging box.
 *  - No `preload` on HSTS — that is an irrevocable commitment for every current
 *    and future subdomain. Add it only when the domain is actually submitted to
 *    hstspreload.org.
 *  - `frame-ancestors 'none'` is the modern equivalent of X-Frame-Options; both
 *    are sent for older browsers. When a full CSP lands, fold frame-ancestors
 *    into it instead of emitting two CSP headers. A full script-src/style-src
 *    policy needs a nonce first: there are inline <style> blocks in the app
 *    shell and the landing page, plus Next's own inline hydration scripts. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@poruchka/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // Old IA: /suppliers + /items merged into /catalog; /schedules renamed /orders.
    return [
      { source: "/schedules", destination: "/orders", permanent: false },
      { source: "/suppliers", destination: "/catalog", permanent: false },
      { source: "/items", destination: "/catalog", permanent: false },
      { source: "/profile", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
