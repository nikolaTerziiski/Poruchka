import type { Metadata } from "next";
import { TriangleAlert, Store, Clock } from "lucide-react";
import { M, toLang, formatDate, type OrderView } from "./copy";
import { ConfirmButton } from "./confirm-button";

/**
 * PUBLIC one-tap order confirmation.
 *
 * Exists so confirming an order needs no account, no app and no chat bot. The
 * reminder can arrive by SMS, by a Viber message pasted by hand, or from the
 * Telegram bot — each just carries a link here. That keeps the core loop
 * independent of whichever messaging platform we can afford, and it is also the
 * only shape Viber Business Messages supports, since that product has no
 * custom keyboards.
 *
 * Server-rendered on purpose. The reader is a cook on a phone, often on a poor
 * connection; the order must be legible the moment the page paints rather than
 * after a client fetch. Only the button is a client component.
 *
 * Deliberately does not use lib/api.ts — that wrapper attaches a Supabase
 * session and redirects to /login on 401, which is precisely wrong for a page
 * whose premise is that the visitor has no account.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Поръчка",
  robots: { index: false, follow: false },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function loadOrder(token: string): Promise<OrderView | null> {
  try {
    const res = await fetch(`${API_URL}/public/orders/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as OrderView;
  } catch {
    return null;
  }
}

const STYLES = `
  .ol-wrap { min-height:100dvh; background:var(--surface-page); display:flex; flex-direction:column;
             align-items:center; padding:24px 16px 48px; }
  .ol-card { width:100%; max-width:520px; background:var(--surface-card); border:1px solid var(--border-subtle);
             border-radius:var(--radius-2xl); box-shadow:var(--shadow-sm); padding:22px 20px; }
  .ol-cta { width:100%; min-height:64px; font-size:19px; font-weight:700; border:none; cursor:pointer;
            border-radius:var(--radius-lg); background:var(--accent); color:var(--text-on-accent);
            display:inline-flex; align-items:center; justify-content:center; gap:10px;
            font-family:var(--font-sans); }
  .ol-cta:disabled { opacity:.6; cursor:default; }
  .ol-cta:focus-visible { outline:3px solid var(--brand-800); outline-offset:3px; }
  .ol-line { display:flex; justify-content:space-between; gap:14px; padding:11px 0;
             border-top:1px solid var(--border-subtle); font-size:16px; }
`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ol-wrap">
      <style>{STYLES}</style>
      <header style={{ display: "flex", alignItems: "center", gap: 9, margin: "6px 0 20px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logomark.svg" width={26} height={26} alt="" />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>
          Poruchka
        </span>
      </header>
      <main className="ol-card">{children}</main>
    </div>
  );
}

export default async function OrderLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await loadOrder(token);

  // No order means an expired, tampered or unknown token. The API answers all
  // three with the same 404 so a link cannot be used to probe which orders
  // exist, and the page says the same thing for the same reason.
  if (!order) {
    const t = M.bg;
    return (
      <Shell>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }} role="alert">
          <TriangleAlert size={22} color="var(--status-escalated-fg)" aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>{t.linkBadTitle}</h1>
            <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--text-body)", lineHeight: 1.6 }}>{t.linkBadBody}</p>
          </div>
        </div>
      </Shell>
    );
  }

  const lang = toLang(order.language);
  const t = M[lang];

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>
        <Store size={15} aria-hidden="true" /> {order.restaurant}
      </div>
      <h1 style={{ fontSize: 23, margin: "0 0 14px", lineHeight: 1.2 }}>{t.orderFrom(order.supplier)}</h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 14, color: "var(--text-body)", marginBottom: 12 }}>
        <span>
          <strong style={{ color: "var(--text-strong)" }}>{t.forDate}:</strong> {formatDate(order.dueDate, lang)}
        </span>
        {order.cutoffTime && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Clock size={14} aria-hidden="true" /> {t.cutoff} {order.cutoffTime}
          </span>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        {order.lines.map((line, i) => (
          <div key={i} className="ol-line">
            <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>
              {line.item}
              {line.note ? (
                <span style={{ display: "block", fontSize: 13.5, color: "var(--text-muted)", fontWeight: 400 }}>{line.note}</span>
              ) : null}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap", color: line.quantity ? "var(--text-strong)" : "var(--text-muted)" }}>
              {line.quantity ? `${line.quantity}${line.unit ? " " + line.unit : ""}` : t.noQuantity}
            </span>
          </div>
        ))}
      </div>

      {order.actionable ? (
        <ConfirmButton token={token} lang={lang} />
      ) : (
        <p style={{ margin: 0, fontSize: 15, color: "var(--text-muted)" }}>
          {order.status === "SUBMITTED" ? t.alreadyBody : order.status === "SKIPPED" ? t.statusSkipped : t.closedBody}
        </p>
      )}
    </Shell>
  );
}
