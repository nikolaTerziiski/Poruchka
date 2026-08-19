"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: number;
  /** Pin this column to the right edge while the rest scrolls sideways.
   *  Meant for the row-action column, so Промени/Изтрий stay in view. */
  stickyRight?: boolean;
}

/** Poruchka Table — shared table primitive for the CRUD screens.
 *
 *  The card keeps `overflow: hidden` for its rounded corners, but the table
 *  itself lives in a horizontal scroller: on a phone the row actions used to be
 *  clipped off the right edge with no way to reach them. */
export function Table<T>({
  columns,
  rows,
  renderCell,
  rowKey,
  label,
  minWidth,
}: {
  columns: Column[];
  rows: T[];
  renderCell: (row: T, key: string, index: number) => ReactNode;
  rowKey: (row: T) => string;
  /** Accessible name for the scrollable region — usually the page heading. */
  label?: string;
  /** Opt-in floor before the table starts scrolling instead of squashing.
   *  Left unset on purpose: auto layout already refuses to squash below
   *  min-content, and a blanket floor forces narrow tables to scroll for
   *  nothing. Pass it only for the genuinely wide tables. */
  minWidth?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atEnd, setAtEnd] = useState(true);
  const [focusRing, setFocusRing] = useState(false);
  const hasSticky = columns.some((c) => c.stickyRight);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScrollable(max > 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  // Viewport / container width changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Content changes (rows loaded, a column added). Cheap: the setters bail out
  // when the measurement has not moved.
  useEffect(measure, [measure, rows, columns]);

  const stickyCell = (header: boolean): CSSProperties => ({
    position: "sticky",
    right: 0,
    zIndex: header ? 2 : 1,
    background: header ? "var(--surface-sunken)" : "var(--surface-card)",
    // Inset rather than a border: with border-collapse a border on a sticky
    // cell is unreliable, an inset shadow always paints.
    boxShadow: scrollable ? "inset 1px 0 0 var(--border-subtle), -8px 0 8px -8px rgba(34, 30, 24, 0.18)" : "none",
  });

  return (
    <div
      style={{
        position: "relative",
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div
        ref={scrollerRef}
        {...(scrollable && label ? { role: "region", "aria-label": label } : {})}
        tabIndex={scrollable ? 0 : undefined}
        onScroll={measure}
        onFocus={(e) => {
          // focusin bubbles: only ring the scroller when it is the thing focused.
          if (e.target !== e.currentTarget) return;
          let visible = true;
          try {
            visible = e.currentTarget.matches(":focus-visible");
          } catch {
            /* browser without :focus-visible — show the ring rather than hide it */
          }
          setFocusRing(visible);
        }}
        onBlur={() => setFocusRing(false)}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          // The card above clips, so the ring has to sit inside the scroller —
          // an outward outline would be cut off and the region would look
          // unfocused while it is the thing responding to the arrow keys.
          outline: "none",
          boxShadow: focusRing ? "inset 0 0 0 2px var(--border-focus)" : "none",
        }}
      >
        <table style={{ width: "100%", minWidth, borderCollapse: "collapse", fontFamily: "var(--font-sans)" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="eyebrow"
                  style={{
                    textAlign: c.align ?? "left",
                    padding: "12px 18px",
                    background: "var(--surface-sunken)",
                    borderBottom: "1px solid var(--border-subtle)",
                    whiteSpace: "nowrap",
                    width: c.width,
                    ...(c.stickyRight ? stickyCell(true) : null),
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={rowKey(row)}
                style={{ borderBottom: ri === rows.length - 1 ? "none" : "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      padding: "14px 18px",
                      fontSize: 14,
                      color: "var(--text-body)",
                      textAlign: c.align ?? "left",
                      verticalAlign: "middle",
                      ...(c.stickyRight ? stickyCell(false) : null),
                    }}
                  >
                    {renderCell(row, c.key, ri)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scrollable && !atEnd && !hasSticky ? (
        // Without a hint nobody discovers the swipe, and the row actions read as
        // if they do not exist.
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 32,
            pointerEvents: "none",
            background: "linear-gradient(to right, transparent, var(--surface-card))",
          }}
        />
      ) : null}
    </div>
  );
}
