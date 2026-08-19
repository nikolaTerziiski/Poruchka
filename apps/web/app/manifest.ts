import type { MetadataRoute } from "next";

/** Web app manifest — kitchen staff run this from a phone home screen.
 * start_url is "/" and not "/dashboard": /dashboard sits behind the client-side
 * auth gate in app/(app)/layout.tsx, so a cold launch would paint the shell and
 * then bounce to /login on every open.
 * Note iOS ignores manifest icons entirely — Safari uses app/apple-icon.png. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poruchka — напомняния за поръчки",
    short_name: "Poruchka",
    description:
      "Никога не пропускайте поръчка към доставчик. Напомняния в Telegram за ресторанти.",
    lang: "bg",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#1c7fc7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
