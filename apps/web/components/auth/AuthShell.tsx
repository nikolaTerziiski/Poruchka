import Link from "next/link";
import type { ReactNode } from "react";

/** Shared centered card layout for login / register / password screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 24px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logomark.svg" width={28} height={28} alt="" />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>
            Poruchka
          </span>
        </Link>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 24px 56px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, letterSpacing: "-0.02em" }}>{title}</h1>
            <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 8 }}>{subtitle}</p>
          </div>
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-2xl)", boxShadow: "var(--shadow-sm)", padding: 24 }}>
            {children}
          </div>
          {footer ? (
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", marginTop: 22 }}>{footer}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
