"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export interface LegalSection {
  readonly heading: string;
  readonly body: string;
}

/** Simple, self-contained layout for the public Terms / Privacy pages. */
export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
  backLabel,
  draftNote,
}: {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: readonly LegalSection[];
  backLabel: string;
  draftNote: string;
}) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-page)", color: "var(--text-body)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "var(--text-muted)", fontSize: 14, fontWeight: 500 }}
        >
          <ArrowLeft size={16} /> {backLabel}
        </Link>
        <LanguageSwitcher compact />
      </header>

      <main id="main" style={{ maxWidth: 760, margin: "0 auto", padding: "8px 20px 80px" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", color: "var(--text-strong)", margin: "8px 0 4px" }}>{title}</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px" }}>{lastUpdated}</p>

        <div
          role="note"
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            background: "var(--brand-50)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            margin: "0 0 28px",
          }}
        >
          {draftNote}
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.7, margin: "0 0 28px" }}>{intro}</p>

        {sections.map((s, i) => (
          <section key={i} style={{ margin: "0 0 24px" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-strong)", margin: "0 0 8px" }}>{s.heading}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, margin: 0, whiteSpace: "pre-line" }}>{s.body}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
