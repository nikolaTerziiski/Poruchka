"use client";

import type { ReactNode } from "react";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: number;
}

/** Poruchka Table — shared table primitive for the CRUD screens. */
export function Table<T>({
  columns,
  rows,
  renderCell,
  rowKey,
}: {
  columns: Column[];
  rows: T[];
  renderCell: (row: T, key: string, index: number) => ReactNode;
  rowKey: (row: T) => string;
}) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-sans)" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align ?? "left",
                  padding: "12px 18px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  background: "var(--surface-sunken)",
                  borderBottom: "1px solid var(--border-subtle)",
                  whiteSpace: "nowrap",
                  width: c.width,
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
                <td key={c.key} style={{ padding: "14px 18px", fontSize: 14, color: "var(--text-body)", textAlign: c.align ?? "left", verticalAlign: "middle" }}>
                  {renderCell(row, c.key, ri)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
