"use client";

import type { ChangeEventHandler, CSSProperties, ReactNode } from "react";

export interface CheckboxProps {
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  style?: CSSProperties;
}

/** Poruchka Checkbox — controlled checkbox with label; azure fill when checked. */
export function Checkbox({ checked = false, onChange, label, disabled = false, id, style = {} }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        userSelect: "none",
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          width: 18,
          height: 18,
          flex: "none",
          borderRadius: "var(--radius-sm)",
          border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
          background: checked ? "var(--accent)" : "var(--surface-card)",
          transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          style={{ position: "absolute", inset: 0, opacity: 0, margin: 0, cursor: "inherit" }}
        />
      </span>
      {label ? (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--text-body)" }}>{label}</span>
      ) : null}
    </label>
  );
}
