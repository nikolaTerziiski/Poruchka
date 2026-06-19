"use client";

import { useState } from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "style"> {
  invalid?: boolean;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
}

/** Poruchka Input — text field. `invalid` switches border + ring to red. */
export function Input({ invalid = false, size = "md", style = {}, disabled = false, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false);
  const heights: Record<string, number> = { sm: 32, md: 40, lg: 48 };
  const composed: CSSProperties = {
    width: "100%",
    height: heights[size] ?? 40,
    padding: "0 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-sm)",
    color: "var(--text-strong)",
    background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
    border: `1px solid ${invalid ? "var(--red-500)" : focus ? "var(--border-focus)" : "var(--border-default)"}`,
    borderRadius: "var(--radius-md)",
    outline: "none",
    boxShadow: focus
      ? `0 0 0 3px ${invalid ? "color-mix(in srgb, var(--red-500) 22%, transparent)" : "var(--ring)"}`
      : "none",
    transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
    cursor: disabled ? "not-allowed" : "text",
    opacity: disabled ? 0.6 : 1,
    ...style,
  };
  return (
    <input
      disabled={disabled}
      style={composed}
      {...rest}
      onFocus={(e) => {
        setFocus(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        rest.onBlur?.(e);
      }}
    />
  );
}
