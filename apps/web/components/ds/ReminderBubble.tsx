"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

export interface ReminderBubbleProps {
  item?: string;
  supplier?: string;
  confirmed?: boolean;
  time?: string;
  onConfirm?: () => void;
  style?: CSSProperties;
}

/**
 * ReminderBubble — the realistic Telegram message mock (ported from the DS).
 * Mirrors the real bot copy from apps/api (dev.controller / bot service).
 */
export function ReminderBubble({
  item = "Pork Meat",
  supplier = "Metro",
  confirmed = false,
  time = "09:00",
  onConfirm,
  style = {},
}: ReminderBubbleProps) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ width: 340, maxWidth: "100%", fontFamily: "var(--font-sans)", ...style }}>
      {/* Bot row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 4 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "var(--radius-pill)",
            flex: "none",
            background: "var(--brand-500)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)" as unknown as number, color: "var(--text-strong)" }}>
          Poruchka bot
        </span>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-faint)" }}>{time}</span>
      </div>

      {/* Bubble */}
      <div
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "4px 16px 16px 16px",
          boxShadow: "var(--shadow-md)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: "var(--text-base)", lineHeight: "var(--leading-snug)", color: "var(--text-strong)" }}>
          <span aria-hidden>🛒</span> Order{" "}
          <strong style={{ fontWeight: "var(--weight-semibold)" as unknown as number }}>{item}</strong> from{" "}
          <strong style={{ fontWeight: "var(--weight-semibold)" as unknown as number }}>{supplier}</strong> today.
        </div>
        <div style={{ marginTop: 6, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          Tap Done when it&apos;s ordered.
        </div>

        <div style={{ marginTop: 14 }}>
          {confirmed ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--status-confirmed-bg)",
                border: "1px solid var(--status-confirmed-bd)",
                color: "var(--status-confirmed-fg)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-semibold)" as unknown as number,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Ordered · confirmed
            </div>
          ) : (
            <button
              onClick={onConfirm}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              style={{
                width: "100%",
                height: 40,
                border: "none",
                cursor: "pointer",
                borderRadius: "var(--radius-md)",
                background: hover ? "var(--accent-hover)" : "var(--accent)",
                color: "#fff",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-semibold)" as unknown as number,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                transition: "background var(--dur-fast) var(--ease-out)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
