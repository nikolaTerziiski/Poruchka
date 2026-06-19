import type { CSSProperties, ReactNode } from "react";

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

/** Poruchka Field — label + optional hint/error wrapper for a control. */
export function Field({ label, htmlFor, hint, error, required = false, children, style = {} }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label ? (
        <label
          htmlFor={htmlFor}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-medium)" as unknown as number,
            color: "var(--text-strong)",
            display: "inline-flex",
            gap: 4,
          }}
        >
          {label}
          {required ? <span style={{ color: "var(--brand-500)" }}>*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--red-600)" }}>{error}</span>
      ) : hint ? (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{hint}</span>
      ) : null}
    </div>
  );
}
