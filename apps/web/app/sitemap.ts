import type { MetadataRoute } from "next";

/* Matches app/layout.tsx: `||` (an empty env var must not win) and no
 * trailing slash, so the absolute URLs below are always well formed. */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://poruchka.bg").replace(/\/+$/, "");

/** Only the publicly reachable routes. Everything under app/(app)/ is behind
 * the auth gate and is disallowed in app/robots.ts. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/register`, lastModified, changeFrequency: "yearly", priority: 0.8 },
    { url: `${siteUrl}/login`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
