import type { ReactNode } from "react";

/** Shared page header for app screens: title + optional subtitle + action slot. */
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontSize: 28, letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle ? <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
