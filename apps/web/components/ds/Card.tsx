"use client";

import { useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "style"> {
  pad?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Poruchka Card — surface container for grouped content. */
export function Card({ pad = "lg", interactive = false, style = {}, children, ...rest }: CardProps) {
  const [hover, setHover] = useState(false);
  const pads: Record<string, number> = { none: 0, sm: 14, md: 18, lg: 24 };
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        boxShadow: hover && interactive ? "var(--shadow-md)" : "var(--shadow-sm)",
        padding: pads[pad] ?? 24,
        transition: "box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)",
        borderColor: hover && interactive ? "var(--border-default)" : "var(--border-subtle)",
        cursor: interactive ? "pointer" : "default",
        ...style,
      }}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      {...rest}
    >
      {children}
    </div>
  );
}
