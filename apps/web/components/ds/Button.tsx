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
  /** Icon-only button: forces a square tap target of at least 44×44 (kitchen
   *  staff on a phone). Always give it an `aria-label`. */
  iconOnly?: boolean;
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
  iconOnly = false,
  disabled = false,
  type = "button",
  style = {},
  children,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  // Keyboard focus only: a mouse click must not leave a ring behind.
  const [focusRing, setFocusRing] = useState(false);

  const sizes: Record<Size, { padding: string; height: number; fontSize: string; gap: number }> = {
    sm: { padding: "0 12px", height: 32, fontSize: "var(--text-sm)", gap: 6 },
    md: { padding: "0 16px", height: 40, fontSize: "var(--text-sm)", gap: 8 },
    lg: { padding: "0 22px", height: 48, fontSize: "var(--text-base)", gap: 9 },
  };

  const palettes: Record<
    Variant,
    { base: CSSProperties; hover: CSSProperties; press: CSSProperties }
  > = {
    primary: {
      base: { background: "var(--accent)", color: "var(--text-on-accent)", borderWidth: 1, borderStyle: "solid", borderColor: "transparent", boxShadow: "var(--shadow-xs)" },
      hover: { background: "var(--accent-hover)" },
      press: { background: "var(--accent-active)" },
    },
    secondary: {
      base: { background: "var(--surface-card)", color: "var(--text-strong)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border-default)", boxShadow: "var(--shadow-xs)" },
      hover: { background: "var(--surface-hover)", borderColor: "var(--border-strong)" },
      press: { background: "var(--surface-inset)" },
    },
    ghost: {
      base: { background: "transparent", color: "var(--text-body)", borderWidth: 1, borderStyle: "solid", borderColor: "transparent" },
      hover: { background: "var(--surface-hover)" },
      press: { background: "var(--surface-inset)" },
    },
    danger: {
      base: { background: "var(--red-500)", color: "#fff", borderWidth: 1, borderStyle: "solid", borderColor: "transparent", boxShadow: "var(--shadow-xs)" },
      hover: { background: "var(--red-600)" },
      press: { background: "var(--red-700)" },
    },
  };

  const sz = sizes[size] ?? sizes.md;
  const pal = palettes[variant] ?? palettes.primary;
  const iconBox = iconOnly ? Math.max(sz.height, 44) : null;

  const composed: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: sz.gap,
    height: iconBox ?? sz.height,
    width: iconBox ?? undefined,
    padding: iconBox ? 0 : sz.padding,
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
    touchAction: "manipulation",
    ...pal.base,
    ...(hover && !disabled ? pal.hover : null),
    ...(press && !disabled ? pal.press : null),
    // The ring has to be an outline, not a box-shadow: every filled variant sets
    // its own inline box-shadow above, and an inline declaration beats the
    // global :focus-visible rule — which is why these buttons had no visible
    // keyboard focus at all. 2px of --border-focus at a 2px offset keeps page
    // background between fill and ring, so it stays legible on the azure
    // primary and the red danger alike (>=3:1 on every surface we paint on).
    // The boxShadow is pinned at the same time: ghost is the one variant with no
    // inline shadow, so the global :focus-visible rule would otherwise stack its
    // own ring on top of this outline — two rings, two different blues.
    ...(focusRing && !disabled
      ? {
          outline: "2px solid var(--border-focus)",
          outlineOffset: 2,
          boxShadow: (pal.base.boxShadow as string | undefined) ?? "none",
        }
      : null),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      style={composed}
      {...rest}
      // Pointer, not mouse: a tap then gets the same press feedback a click
      // does, and the state clears on pointerleave/cancel instead of sticking.
      onPointerEnter={(e) => {
        setHover(true);
        rest.onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        setHover(false);
        setPress(false);
        rest.onPointerLeave?.(e);
      }}
      onPointerDown={(e) => {
        setPress(true);
        rest.onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPress(false);
        rest.onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        setPress(false);
        rest.onPointerCancel?.(e);
      }}
      onFocus={(e) => {
        let visible = true;
        try {
          visible = e.currentTarget.matches(":focus-visible");
        } catch {
          /* browser without :focus-visible — show the ring rather than hide it */
        }
        setFocusRing(visible);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocusRing(false);
        setPress(false);
        rest.onBlur?.(e);
      }}
      // Keyboard activation gets the same press feedback as a pointer.
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setPress(true);
        rest.onKeyDown?.(e);
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") setPress(false);
        rest.onKeyUp?.(e);
      }}
    >
      {icon ? <span style={{ display: "inline-flex", marginLeft: iconBox ? 0 : -2 }}>{icon}</span> : null}
      {children}
      {iconRight ? <span style={{ display: "inline-flex", marginRight: iconBox ? 0 : -2 }}>{iconRight}</span> : null}
    </button>
  );
}
