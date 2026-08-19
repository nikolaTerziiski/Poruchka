"use client";

import { useState } from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "style"> {
  invalid?: boolean;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
}

/**
 * Poruchka Input — text field. `invalid` switches border + ring to red.
 *
 * Every native <input> attribute is forwarded, so password managers are supported by
 * passing them at the call site: `autoComplete="email" | "current-password" |
 * "new-password" | "organization"`, plus `name` and `type`. Auth forms must set them —
 * without `autoComplete` on the password field, managers will not offer to save or fill.
 *
 * Border uses --border-default (warm-500, 3.78:1 on --surface-card / 3.54:1 on
 * --surface-page), which is what SC 1.4.11 needs for a control boundary. Do not
 * downgrade it to --border-subtle, which is decorative-only.
 */
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
    // --ring is fully opaque now, so a flush 3px ring paints a hard slab against
    // the field border. Use the shared two-layer token (surface spacer + ring),
    // which is what Checkbox already uses, and the real --ring-invalid instead of
    // a hand-rolled red wash.
    boxShadow: focus ? (invalid ? "var(--shadow-focus-invalid)" : "var(--shadow-focus)") : "none",
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
