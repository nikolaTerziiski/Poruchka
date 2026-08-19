"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { useCommon } from "@/lib/i18n";

export interface DialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Label on the confirm button while `busy`. Defaults to Запазване… / Изтриване… by tone. */
  busyLabel?: string;
  tone?: "default" | "danger";
  confirmDisabled?: boolean;
  busy?: boolean;
  /**
   * Allow a click on the dimmed backdrop to close the dialog. Off by default:
   * most dialogs hold a half-filled form and a stray tap beside the panel must
   * not throw the work away. Turn it on for read-only dialogs.
   */
  dismissOnBackdrop?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  width?: number;
}

/** Poruchka Dialog — centered modal with dimmed backdrop.
 *  Thin wrapper: all hooks live in DialogPanel so the `open` guard can never
 *  make a hook call conditional (React would throw on the first open/close). */
export function Dialog({ open = true, ...rest }: DialogProps) {
  if (!open) return null;
  return <DialogPanel {...rest} />;
}

/** Everything focusable a keyboard user can land on inside the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogPanel({
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  busyLabel,
  tone = "default",
  confirmDisabled = false,
  busy = false,
  dismissOnBackdrop = false,
  onConfirm,
  onCancel,
  width = 460,
}: Omit<DialogProps, "open">) {
  const c = useCommon();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Where the press began. A click fires on the nearest common ancestor of
  // mousedown and mouseup, so a text drag that starts in an input and ends over
  // the backdrop would otherwise read as "clicked outside" and wipe the form.
  const pressedBackdrop = useRef(false);
  // Latest props for the document-level key handler, so it can register once.
  const latest = useRef({ busy, onCancel });
  useEffect(() => {
    latest.current = { busy, onCancel };
  });

  // Move focus in, lock the page behind, and put focus back where it came from.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      // The opener may have been the row the dialog just deleted; focusing a
      // detached node silently drops focus to <body>.
      if (opener && document.contains(opener) && typeof opener.focus === "function") opener.focus();
    };
  }, []);

  // Escape closes; Tab is trapped inside the panel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!latest.current.busy) latest.current.onCancel?.();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      // Recomputed every time: dialog contents are dynamic (receiving rows, selects).
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      const active = document.activeElement as HTMLElement | null;
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!active || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const confirmText = busy ? busyLabel ?? (tone === "danger" ? c.deleting : c.saving) : confirmLabel ?? c.save;
  const cancelText = cancelLabel ?? c.cancel;

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
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (!dismissOnBackdrop || busy) return;
        if (!pressedBackdrop.current || e.target !== e.currentTarget) return;
        onCancel?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={{
          width,
          maxWidth: "100%",
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
          <h2
            id={titleId}
            style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xl)", color: "var(--text-strong)", letterSpacing: "var(--tracking-snug)" }}
          >
            {title}
          </h2>
        ) : null}
        {description ? (
          <div id={descId} style={{ marginTop: 6, fontSize: "var(--text-sm)", color: "var(--text-muted)", lineHeight: "var(--leading-normal)" }}>{description}</div>
        ) : null}
        {children ? <div style={{ marginTop: 18 }}>{children}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelText}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={confirmDisabled || busy}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
