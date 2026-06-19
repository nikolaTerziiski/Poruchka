"use client";

import { useState } from "react";
import type { CSSProperties, SelectHTMLAttributes } from "react";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "style"> {
  invalid?: boolean;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
}

/** Poruchka Select — native dropdown styled to match Input. */
export function Select({ invalid = false, size = "md", style = {}, disabled = false, children, ...rest }: SelectProps) {
  const [focus, setFocus] = useState(false);
  const heights: Record<string, number> = { sm: 32, md: 40, lg: 48 };
  return (
    <select
      disabled={disabled}
      style={{
        width: "100%",
        height: heights[size] ?? 40,
        padding: "0 36px 0 12px",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        color: "var(--text-strong)",
        background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
        border: `1px solid ${invalid ? "var(--red-500)" : focus ? "var(--border-focus)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        outline: "none",
        appearance: "none",
        WebkitAppearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238c8273' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 11px center",
        boxShadow: focus ? "0 0 0 3px var(--ring)" : "none",
        transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      {...rest}
    >
      {children}
    </select>
  );
}
