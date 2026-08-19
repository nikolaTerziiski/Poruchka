import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Wix_Madefor_Display, Wix_Madefor_Text } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

/* Webfonts are self-hosted at build time by next/font (no CDN request, no
 * render-blocking @import, no visitor IP sent to Google).
 *
 * All three carry a real `cyrillic` subset — the previous pair did not:
 * Bricolage Grotesque ships latin/latin-ext/vietnamese only, and Hanken
 * Grotesk ships cyrillic-EXT (U+0460–052F) but not basic Cyrillic
 * (U+0400–045F), so every Bulgarian letter in the product silently fell back
 * to the OS font. Wix Madefor Display/Text is a designed display+text pair,
 * which keeps the heading/body contrast the brand relies on — now visible in
 * Bulgarian too. The variables are consumed in app/globals.css.
 * No `weight` is passed: all three are variable fonts, so the full axis is
 * emitted and the --weight-* tokens in ds/typography.css keep working. */
const display = Wix_Madefor_Display({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-display-src",
});

const sans = Wix_Madefor_Text({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-sans-src",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-mono-src",
});

/* `||` and not `??`: an env var that is present but empty is the common
 * deployment slip, and `new URL("")` throws at module load, which would fail
 * the whole build. The trailing slash is stripped so app/sitemap.ts and
 * app/robots.ts, which template this same value, never emit a double slash. */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://poruchka.bg").replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Poruchka — напомняния за поръчки към доставчици",
    template: "%s · Poruchka",
  },
  description:
    "Никога не пропускайте поръчка към доставчик. Poruchka изпраща напомняне в Telegram на отговорника, а потвърждението е с едно натискане.",
  applicationName: "Poruchka",
  appleWebApp: { capable: true, title: "Poruchka", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "bg_BG",
    siteName: "Poruchka",
    url: "/",
    title: "Poruchka — напомняния за поръчки към доставчици",
    description:
      "Никога повече пропусната поръчка. Отговорникът получава напомняне в Telegram и потвърждава с едно натискане.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#1c7fc7",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
