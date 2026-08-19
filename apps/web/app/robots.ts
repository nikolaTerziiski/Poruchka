import type { MetadataRoute } from "next";

/* Matches app/layout.tsx: `||` (an empty env var must not win) and no
 * trailing slash, so the absolute URLs below are always well formed. */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://poruchka.bg").replace(/\/+$/, "");

/** The marketing pages (/, /terms, /privacy) are already crawlable; the point
 * here is to keep the authenticated shells out of the index. Each path below is
 * a directory that exists under app/(app)/ — a robots prefix match also covers
 * everything nested under it. /forgot-password is excluded too: there is no
 * reason to index a password-reset form. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/orders",
        "/suppliers",
        "/items",
        "/schedules",
        "/team",
        "/settings",
        "/forgot-password",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
