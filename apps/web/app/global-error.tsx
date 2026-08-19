"use client";

/* Last-resort boundary: it replaces the root layout, so LanguageProvider, the
 * design-system stylesheets and the next/font variables are all gone by the
 * time this renders. Everything here is therefore inline and hardcoded — the
 * token names would resolve to nothing, and the page would look broken, which
 * defeats the point. Copy is Bulgarian only (the app's default language, see
 * lib/i18n.tsx) because there is no language context left to read. */
const PAGE = "#faf7f2";
const INK = "#221e18";
const BODY = "#4e4639";
const ACCENT = "#1667a6";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="bg">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          background: PAGE,
          color: BODY,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          lineHeight: 1.5,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logomark.svg" width={40} height={40} alt="" />
          <h1
            style={{
              margin: "18px 0 0",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            Нещо се обърка
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 15 }}>
            Презаредете страницата. Ако проблемът продължи, свържете се с нас.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              height: 44,
              padding: "0 22px",
              border: "1px solid transparent",
              borderRadius: 8,
              background: ACCENT,
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Презаредете
          </button>
        </div>
      </body>
    </html>
  );
}
