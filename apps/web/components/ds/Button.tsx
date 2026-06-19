"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  style?: CSSProperties;
}

/**
 * Poruchka Button — primary action primitive (ported from the design system).
 * Variants: primary (azure), secondary (outline), ghost, danger. Token-styled.
 */
export function Button({
  variant = "primary",
  size = "md",
  icon = null,
  iconRight = null,
  disabled = false,
  type = "button",
  style = {},
  children,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const sizes: Record<Size, CSSProperties & { gap: number }> = {
    sm: { padding: "0 12px", height: 32, fontSize: "var(--text-sm)", gap: 6 },
    md: { padding: "0 16px", height: 40, fontSize: "var(--text-sm)", gap: 8 },
    lg: { padding: "0 22px", height: 48, fontSize: "var(--text-base)", gap: 9 },
  };

  const palettes: Record<
    Variant,
    { base: CSSProperties; hover: CSSProperties; press: CSSProperties }
  > = {
    primary: {
      base: { background: "var(--accent)", color: "var(--text-on-accent)", border: "1px solid transparent", boxShadow: "var(--shadow-xs)" },
      hover: { background: "var(--accent-hover)" },
      press: { background: "var(--accent-active)" },
    },
    secondary: {
      base: { background: "var(--surface-card)", color: "var(--text-strong)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-xs)" },
      hover: { background: "var(--surface-hover)", borderColor: "var(--border-strong)" },
      press: { background: "var(--surface-inset)" },
    },
    ghost: {
      base: { background: "transparent", color: "var(--text-body)", border: "1px solid transparent" },
      hover: { background: "var(--surface-hover)" },
      press: { background: "var(--surface-inset)" },
    },
    danger: {
      base: { background: "var(--red-500)", color: "#fff", border: "1px solid transparent", boxShadow: "var(--shadow-xs)" },
      hover: { background: "var(--red-600)" },
      press: { background: "var(--red-700)" },
    },
  };

  const sz = sizes[size] ?? sizes.md;
  const pal = palettes[variant] ?? palettes.primary;

  const composed: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: sz.gap,
    height: sz.height,
    padding: sz.padding,
    fontFamily: "var(--font-sans)",
    fontSize: sz.fontSize,
    fontWeight: "var(--weight-semibold)" as unknown as number,
    lineHeight: 1,
    borderRadius: "var(--radius-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition:
      "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
    transform: press && !disabled ? "translateY(0.5px) scale(0.99)" : "none",
    whiteSpace: "nowrap",
    userSelect: "none",
    ...pal.base,
    ...(hover && !disabled ? pal.hover : null),
    ...(press && !disabled ? pal.press : null),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      style={composed}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", marginLeft: -2 }}>{icon}</span> : null}
      {children}
      {iconRight ? <span style={{ display: "inline-flex", marginRight: -2 }}>{iconRight}</span> : null}
    </button>
  );
}
