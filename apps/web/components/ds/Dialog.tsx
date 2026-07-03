"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

export interface DialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  tone?: "default" | "danger";
  confirmDisabled?: boolean;
  secondaryDisabled?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onSecondary?: () => void;
  width?: number;
}

/** Poruchka Dialog — centered modal with dimmed backdrop. */
export function Dialog({
  open = true,
  title,
  description,
  children,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  secondaryLabel,
  tone = "default",
  confirmDisabled = false,
  secondaryDisabled = false,
  busy = false,
  onConfirm,
  onCancel,
  onSecondary,
  width = 460,
}: DialogProps) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "color-mix(in srgb, var(--warm-900) 42%, transparent)",
        backdropFilter: "blur(2px)",
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-2xl)",
          boxShadow: "var(--shadow-lg)",
          padding: 24,
        }}
      >
        {title ? (
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xl)", color: "var(--text-strong)", letterSpacing: "var(--tracking-snug)" }}>
            {title}
          </div>
        ) : null}
        {description ? (
          <div style={{ marginTop: 6, fontSize: "var(--text-sm)", color: "var(--text-muted)", lineHeight: "var(--leading-normal)" }}>{description}</div>
        ) : null}
        {children ? <div style={{ marginTop: 18 }}>{children}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          {secondaryLabel ? (
            <Button variant="ghost" onClick={onSecondary} disabled={secondaryDisabled || busy}>{secondaryLabel}</Button>
          ) : null}
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={confirmDisabled || busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
