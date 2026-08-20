"use client";

import { useState } from "react";
import { Check, PackageCheck } from "lucide-react";
import { M, toLang, type Lang } from "./copy";

/** The only interactive part of the confirm page.
 *
 * Everything else is server-rendered so the order is legible the instant the
 * page paints — the person opening this is on a phone, often on a poor
 * connection, and must not watch a spinner to find out what to order.
 */
export function ConfirmButton({ token, lang }: { token: string; lang: Lang }) {
  const t = M[lang];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    outcome: "submitted" | "already_submitted" | "closed";
    lang: Lang;
  } | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/public/orders/${encodeURIComponent(token)}/confirm`,
        { method: "POST" },
      );
      if (!res.ok) {
        setError(t.failed);
        return;
      }
      const body = (await res.json()) as {
        outcome: "submitted" | "already_submitted" | "closed";
        language?: string;
      };
      setDone({ outcome: body.outcome, lang: toLang(body.language) });
    } catch {
      // A thrown fetch here is a transport failure, not an API error — the user
      // is most likely out of signal, so say that rather than blaming the app.
      setError(t.offline);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const d = M[done.lang];
    const title =
      done.outcome === "submitted" ? d.doneTitle : done.outcome === "already_submitted" ? d.alreadyTitle : d.closedTitle;
    const body =
      done.outcome === "submitted" ? d.doneBody : done.outcome === "already_submitted" ? d.alreadyBody : d.closedBody;
    return (
      <div style={{ textAlign: "center", paddingTop: 4 }} role="status" aria-live="polite">
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 60, height: 60, borderRadius: "50%",
            background: "var(--status-confirmed-bg)", border: "1px solid var(--status-confirmed-bd)",
            marginBottom: 12,
          }}
        >
          {done.outcome === "closed" ? (
            <PackageCheck size={28} color="var(--status-confirmed-fg)" aria-hidden="true" />
          ) : (
            <Check size={30} color="var(--status-confirmed-fg)" aria-hidden="true" />
          )}
        </span>
        <h2 style={{ fontSize: 21, margin: 0 }}>{title}</h2>
        <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-body)", lineHeight: 1.6 }}>{body}</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" style={{ margin: "0 0 12px", fontSize: 14.5, color: "var(--status-escalated-fg)" }}>
          {error}
        </p>
      )}
      <button className="ol-cta" onClick={() => void confirm()} disabled={busy}>
        <Check size={22} aria-hidden="true" /> {busy ? t.confirming : t.confirm}
      </button>
      <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
        {t.confirmHint}
      </p>
    </>
  );
}
