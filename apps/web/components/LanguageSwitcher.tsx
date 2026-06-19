"use client";

import { useLang, useSetLang, type Lang } from "@/lib/i18n";

/** Compact EN | BG toggle. Persists the choice via the language provider. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const setLang = useSetLang();
  const opts: Lang[] = ["bg", "en"];
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-pill)",
        overflow: "hidden",
        background: "var(--surface-card)",
        flex: "none",
      }}
    >
      {opts.map((l) => {
        const on = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={on}
            style={{
              border: "none",
              cursor: "pointer",
              padding: compact ? "3px 9px" : "5px 11px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              background: on ? "var(--accent)" : "transparent",
              color: on ? "#fff" : "var(--text-muted)",
            }}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
