import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "accent" | "confirmed" | "pending" | "escalated";

const TONES: Record<Tone, { fg: string; bg: string; bd: string; dot: string }> = {
  neutral: { fg: "var(--warm-700)", bg: "var(--warm-100)", bd: "var(--warm-200)", dot: "var(--warm-500)" },
  accent: { fg: "var(--brand-700)", bg: "var(--brand-50)", bd: "var(--brand-100)", dot: "var(--brand-500)" },
  confirmed: { fg: "var(--status-confirmed-fg)", bg: "var(--status-confirmed-bg)", bd: "var(--status-confirmed-bd)", dot: "var(--status-confirmed-dot)" },
  pending: { fg: "var(--status-pending-fg)", bg: "var(--status-pending-bg)", bd: "var(--status-pending-bd)", dot: "var(--status-pending-dot)" },
  escalated: { fg: "var(--status-escalated-fg)", bg: "var(--status-escalated-bg)", bd: "var(--status-escalated-bd)", dot: "var(--status-escalated-dot)" },
};

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "style"> {
  tone?: Tone;
  dot?: boolean;
  size?: "sm" | "md";
  style?: CSSProperties;
  children?: ReactNode;
}

/** Poruchka Badge / StatusPill — compact status & metadata label. */
export function Badge({ tone = "neutral", dot = false, size = "md", style = {}, children, ...rest }: BadgeProps) {
  const t = TONES[tone] ?? TONES.neutral;
  const sizes = {
    sm: { fontSize: "var(--text-2xs)", padding: dot ? "2px 8px 2px 7px" : "2px 8px", height: 20, gap: 5 },
    md: { fontSize: "var(--text-xs)", padding: dot ? "3px 10px 3px 8px" : "3px 10px", height: 24, gap: 6 },
  } as const;
  const sz = sizes[size] ?? sizes.md;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sz.gap,
        height: sz.height,
        padding: sz.padding,
        fontFamily: "var(--font-sans)",
        fontSize: sz.fontSize,
        fontWeight: "var(--weight-semibold)" as unknown as number,
        lineHeight: 1,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {dot ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.dot, flex: "none" }} /> : null}
      {children}
    </span>
  );
}
