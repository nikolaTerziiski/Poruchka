import type { CSSProperties, ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  style?: CSSProperties;
}

/** Poruchka EmptyState — the "nothing here yet" surface. */
export function EmptyState({ icon = null, title, description, action = null, style = {} }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "48px 24px", ...style }}>
      {icon ? (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: "var(--radius-xl)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", marginBottom: 16 }}>
          {icon}
        </span>
      ) : null}
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--text-strong)", letterSpacing: "var(--tracking-snug)" }}>{title}</div>
      {description ? (
        <div style={{ marginTop: 6, maxWidth: 360, fontSize: "var(--text-sm)", color: "var(--text-muted)", lineHeight: "var(--leading-normal)" }}>{description}</div>
      ) : null}
      {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
    </div>
  );
}
