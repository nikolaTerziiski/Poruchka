"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarPlus, Clock, Check, TriangleAlert, CircleSlash } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { useTr, useLang, apiErrorText, type Lang } from "@/lib/i18n";

/* Weekday abbreviations. INDEX 0 IS MONDAY and must stay that way: computeWeek()
 * builds the week from Monday, and schedules/page.tsx maps the stored weekday
 * numbers 1-7 through the same order, so a Sunday-first (CLDR) order would
 * silently shift every saved plan by a day.
 * The Bulgarian set is the two-letter one required by docs/BG-TERMINOLOGY.md
 * style rule 7 — two letters, consistently; do not re-introduce the three-letter
 * forms, which that rule names as non-standard. */
const LABELS = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
} as const;

const M = {
  en: {
    title: "Order calendar",
    weekOf: (range: string) => `Week of ${range}`,
    today: "Today",
    prevWeek: "Previous week",
    nextWeek: "Next week",
    statPending: "Pending today & ahead",
    statConfirmed: "Confirmed this week",
    statEscalated: "Overdue — needs attention",
    emptyTitle: "No orders this week",
    emptyDesc: "Create an order plan (e.g. Pork Meat from Metro, every Wednesday) — reminders will show up here.",
    createSchedule: "Create order plan",
    loading: "Loading orders…",
    loadFailed: "Orders could not be loaded. Try again.",
    noOrders: "No orders",
    itemCount: (n: number) => (n === 1 ? "1 item" : `${n} items`),
    statusLabel: { pending: "Waiting", confirmed: "Confirmed", escalated: "Overdue", skipped: "Skipped" },
  },
  bg: {
    title: "Календар на поръчките",
    weekOf: (range: string) => `Седмица ${range}`,
    today: "Днес",
    prevWeek: "Предходна седмица",
    nextWeek: "Следваща седмица",
    statPending: "Предстоящи (днес и напред)",
    statConfirmed: "Потвърдени тази седмица",
    statEscalated: "Просрочени — искат внимание",
    emptyTitle: "Няма поръчки тази седмица",
    emptyDesc: "Създайте план за поръчка (напр. свинско месо от Метро, всяка сряда) — напомнянията ще се появят тук.",
    createSchedule: "Създай план",
    loading: "Зареждане на поръчките…",
    loadFailed: "Поръчките не можаха да бъдат заредени. Опитайте отново.",
    noOrders: "Няма поръчки",
    itemCount: (n: number) => (n === 1 ? "1 артикул" : `${n} артикула`),
    statusLabel: { pending: "Чака", confirmed: "Потвърдена", escalated: "Просрочена", skipped: "Пропусната" },
  },
} as const;

/** One row per order LINE, as returned by apps/api/src/features/reminders.controller.ts.
 *  `status` is unvalidated JSON off the wire; the controller emits exactly
 *  "pending" | "escalated" | "skipped" | "confirmed" (see statusTone below). */
interface Reminder {
  date: string;
  orderRunId: string;
  item: string;
  supplier: string;
  assignee: string;
  time: string;
  status: string;
}

/** One order (OrderRun) with its lines folded in — what a day cell actually shows. */
interface DayOrder {
  orderRunId: string;
  supplier: string;
  assignee: string;
  time: string;
  status: string;
  items: string[];
}

type Tone = "pending" | "confirmed" | "escalated" | "skipped";

/* Status is carried by an icon, not by colour alone (WCAG 1.4.1): amber and green
 * at 7px are indistinguishable in greyscale and for a colour-blind owner. The -fg
 * tokens are used rather than -dot so a 12px glyph stays legible; "skipped" has no
 * status token family, so it resolves through this table instead of an interpolated
 * `var(--status-${tone}-dot)`, which would have produced a transparent dot. */
const STATUS: Record<Tone, { Icon: LucideIcon; color: string }> = {
  pending: { Icon: Clock, color: "var(--status-pending-fg)" },
  confirmed: { Icon: Check, color: "var(--status-confirmed-fg)" },
  escalated: { Icon: TriangleAlert, color: "var(--status-escalated-fg)" },
  skipped: { Icon: CircleSlash, color: "var(--text-muted)" },
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeWeek(lang: Lang, anchor: Date) {
  const locale = lang === "bg" ? "bg-BG" : "en-US";
  const today = new Date();
  const mondayOffset = (anchor.getDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(anchor.getDate() - mondayOffset);

  const days = LABELS[lang].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const month = d.toLocaleString(locale, { month: "long" });
    return {
      label,
      date: d.getDate(),
      // Used by the stacked (narrow) layout, where a bare "Чт" + "16" pair reads as noise.
      // Bulgarian wants the comma and a lowercase month: "Чт, 16 юли".
      longLabel: lang === "bg" ? `${label}, ${d.getDate()} ${month}` : `${label}, ${month} ${d.getDate()}`,
      iso: toISODate(d),
      isToday: d.toDateString() === today.toDateString(),
    };
  });

  // The range must be built from two real Dates. Printing one month name for the
  // whole week produced "Седмица 30–5 август" — a range running backwards.
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  // formatRange gives "27 юли – 2 август" / "17 – 23 август"; the fallback keeps
  // older engines that lack it from throwing mid-render.
  const rangeLabel =
    typeof fmt.formatRange === "function"
      ? fmt.formatRange(monday, sunday)
      : `${fmt.format(monday)} – ${fmt.format(sunday)}`;

  return { days, rangeLabel };
}

/* The API emits four statuses, not three. "skipped" used to fall through to the
 * amber "pending" dot, so an order the owner had deliberately skipped from Telegram
 * still looked outstanding on the calendar. */
function statusTone(status: string): Tone {
  if (status === "confirmed") return "confirmed";
  if (status === "escalated") return "escalated";
  if (status === "skipped") return "skipped";
  return "pending";
}

/** /reminders returns one row per order line. The calendar shows one chip per ORDER,
 *  otherwise a 10-item Metro order paints ten near-identical chips on one day — and
 *  ten links to the same destination. Lines are folded into `items`. */
function groupByOrder(list: Reminder[]): DayOrder[] {
  const out: DayOrder[] = [];
  const index = new Map<string, DayOrder>();
  for (const r of list) {
    let entry = index.get(r.orderRunId);
    if (!entry) {
      entry = {
        orderRunId: r.orderRunId,
        supplier: r.supplier,
        assignee: r.assignee,
        time: r.time,
        status: r.status,
        items: [],
      };
      index.set(r.orderRunId, entry);
      out.push(entry);
    }
    entry.items.push(r.item);
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

function SummaryStat({ tone, n, label }: { tone: "pending" | "confirmed" | "escalated"; n: number; label: string }) {
  return (
    <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "14px 18px", boxShadow: "var(--shadow-xs)" }}>
      <span style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `var(--status-${tone}-bg)`, border: `1px solid var(--status-${tone}-bd)`, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: `var(--status-${tone}-dot)` }} />
      </span>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1 }}>{n}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

/** A chip is a link to the order it represents. `week` travels with it so a chip
 *  clicked on a past or future week does not land on the Orders page's current week
 *  with the order nowhere in sight. */
function OrderChip({ order, weekStart }: { order: DayOrder; weekStart: string }) {
  const t = useTr(M);
  const tone = statusTone(order.status);
  const { Icon, color } = STATUS[tone];
  const skipped = tone === "skipped";
  const itemsLabel = order.items.length === 1 ? order.items[0] : t.itemCount(order.items.length);
  const person = order.assignee.split("@")[0].split(" ")[0];
  return (
    <Link
      className="cal-chip"
      data-skipped={skipped ? "true" : undefined}
      href={`/orders?run=${encodeURIComponent(order.orderRunId)}&week=${weekStart}`}
    >
      <span className="cal-chip-top">
        <span className="cal-chip-icon" style={{ color }} title={t.statusLabel[tone]}>
          <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <span className="cal-sr">{t.statusLabel[tone]}</span>
        <span className="cal-chip-time">{order.time}</span>
        {skipped ? <span className="cal-chip-skipped">{t.statusLabel.skipped}</span> : null}
      </span>
      <span className="cal-chip-title" title={order.supplier}>{order.supplier}</span>
      <span className="cal-chip-meta" title={`${order.items.join(", ")} · ${order.assignee}`}>
        {itemsLabel} · {person}
      </span>
    </Link>
  );
}

/* Layout lives in classes rather than inline styles because it needs media queries.
 * Same pattern as the app shell (app/(app)/layout.tsx).
 *   - The week grid can shrink (minmax(0, 1fr)) instead of forcing a 900px floor,
 *     and stacks into rows once the columns get too narrow to read. That removes
 *     the horizontal scroll region entirely.
 *   - Empty days collapse to one line instead of disappearing: "did we miss
 *     Thursday?" has to stay answerable.
 *   - Page gutters shrink on small screens; 36px each side is 19% of a 375px phone. */
const CSS = `
.cal-page { padding: var(--space-8) 36px; max-width: var(--content-max); margin: 0 auto; }
.cal-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--space-2-5); align-items: start; }
.cal-day { background: var(--surface-sunken); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-2-5); min-height: 180px; }
.cal-day[data-today="true"] { background: var(--brand-50); border-color: var(--brand-200); }
.cal-dayhead { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-2-5); padding: 0 2px; }
.cal-dow { font-size: var(--text-2xs); font-weight: var(--weight-semibold); letter-spacing: var(--tracking-eyebrow); text-transform: uppercase; color: var(--text-muted); }
.cal-dom { font-family: var(--font-display); font-size: 16px; font-weight: var(--weight-bold); color: var(--text-strong); }
.cal-dayfull { display: none; font-family: var(--font-display); font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-strong); }
.cal-day[data-today="true"] .cal-dow,
.cal-day[data-today="true"] .cal-dom,
.cal-day[data-today="true"] .cal-dayfull { color: var(--brand-700); }
.cal-list { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.cal-empty { font-size: var(--text-xs); color: var(--text-muted); padding: 4px 2px; }
.cal-empty-text { display: none; }
.cal-chip { display: block; min-width: 0; overflow: hidden; padding: 9px 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-card); color: inherit; text-decoration: none; transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out); }
.cal-chip:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); text-decoration: none; }
.cal-chip-top { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
.cal-chip-icon { display: inline-flex; flex: none; }
.cal-chip-time { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-muted); }
.cal-chip-skipped { font-size: var(--text-2xs); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-chip-title { display: block; font-size: 13px; font-weight: var(--weight-semibold); color: var(--text-strong); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cal-chip-meta { display: block; font-size: var(--text-2xs); color: var(--text-muted); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cal-chip[data-skipped="true"] .cal-chip-title { color: var(--text-muted); text-decoration: line-through; }
.cal-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@media (max-width: 1219px) {
  .cal-week { grid-template-columns: 1fr; gap: var(--space-2); }
  .cal-day { min-height: 0; }
  .cal-dow, .cal-dom { display: none; }
  .cal-dayfull { display: inline; }
  .cal-dayhead { margin-bottom: var(--space-2); }
  .cal-list { flex-direction: row; flex-wrap: wrap; }
  .cal-chip { flex: 1 1 220px; }
  .cal-chip-title { white-space: normal; }
  .cal-empty-dash { display: none; }
  .cal-empty-text { display: inline; }
  .cal-day[data-empty="true"] { display: flex; align-items: baseline; gap: var(--space-2); padding: 6px 10px; }
  .cal-day[data-empty="true"] .cal-dayhead { margin-bottom: 0; }
}
@media (max-width: 1023px) { .cal-page { padding: var(--space-6) var(--space-5); } }
@media (max-width: 600px) { .cal-page { padding: var(--space-5) var(--space-4); } }
`;

export default function DashboardPage() {
  const router = useRouter();
  const t = useTr(M);
  const lang = useLang();
  const [anchor, setAnchor] = useState(() => new Date());
  const { days, rangeLabel } = useMemo(() => computeWeek(lang, anchor), [anchor, lang]);
  const weekStart = days[0].iso;
  const weekEnd = days[6].iso;
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await api<Reminder[]>(`/reminders?from=${weekStart}&to=${weekEnd}`);
        if (!cancelled) setReminders(data);
      } catch (cause) {
        // Never render the raw thrown message — it is an untranslated transport string.
        if (!cancelled) setError(apiErrorText(cause, lang, t.loadFailed));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, t.loadFailed, weekEnd, weekStart]);

  const byDate: Record<string, Reminder[]> = {};
  for (const r of reminders) (byDate[r.date] ??= []).push(r);
  const todayIso = toISODate(new Date());
  const countRuns = (predicate: (reminder: Reminder) => boolean) =>
    new Set(reminders.filter(predicate).map((reminder) => reminder.orderRunId)).size;
  const counts = {
    pending: countRuns((r) => r.status === "pending" && r.date >= todayIso),
    confirmed: countRuns((r) => r.status === "confirmed"),
    escalated: countRuns((r) => r.status === "escalated"),
  };

  return (
    <div className="cal-page">
      <style>{CSS}</style>
      <PageHead
        title={t.title}
        subtitle={t.weekOf(rangeLabel)}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="md" iconOnly icon={<ChevronLeft size={16} />} aria-label={t.prevWeek} onClick={() => setAnchor((current) => { const next = new Date(current); next.setDate(next.getDate() - 7); return next; })} />
            <Button variant="secondary" size="md" onClick={() => setAnchor(new Date())}>{t.today}</Button>
            <Button variant="secondary" size="md" iconOnly icon={<ChevronRight size={16} />} aria-label={t.nextWeek} onClick={() => setAnchor((current) => { const next = new Date(current); next.setDate(next.getDate() + 7); return next; })} />
          </div>
        }
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <SummaryStat tone="pending" n={counts.pending} label={t.statPending} />
        <SummaryStat tone="confirmed" n={counts.confirmed} label={t.statConfirmed} />
        <SummaryStat tone="escalated" n={counts.escalated} label={t.statEscalated} />
      </div>

      {error ? (
        <div style={{ marginBottom: 18, padding: "11px 14px", border: "1px solid var(--status-escalated-bd)", borderRadius: "var(--radius-md)", background: "var(--status-escalated-bg)", color: "var(--status-escalated-fg)", fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginBottom: 18, padding: "11px 14px", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-muted)", fontSize: 13 }}>
          {t.loading}
        </div>
      ) : null}

      {!loading && !error && reminders.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "18px 20px", marginBottom: 22, boxShadow: "var(--shadow-xs)", flexWrap: "wrap" }}>
          <span style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--brand-50)", border: "1px solid var(--brand-100)", color: "var(--brand-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <CalendarPlus size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>{t.emptyTitle}</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>
              {t.emptyDesc}
            </div>
          </div>
          <Button variant="primary" size="md" onClick={() => router.push("/schedules")}>{t.createSchedule}</Button>
        </div>
      )}

      <div className="cal-week">
        {days.map((day) => {
          const dayOrders = groupByOrder(byDate[day.iso] ?? []);
          return (
            <div
              key={day.iso}
              className="cal-day"
              data-today={day.isToday ? "true" : undefined}
              data-empty={dayOrders.length === 0 ? "true" : undefined}
            >
              <div className="cal-dayhead">
                <span className="cal-dow">{day.label}</span>
                <span className="cal-dom">{day.date}</span>
                <span className="cal-dayfull">{day.longLabel}</span>
              </div>
              <div className="cal-list">
                {dayOrders.length === 0 ? (
                  <span className="cal-empty">
                    <span className="cal-empty-dash">—</span>
                    <span className="cal-empty-text">{t.noOrders}</span>
                  </span>
                ) : (
                  dayOrders.map((order) => <OrderChip key={order.orderRunId} order={order} weekStart={weekStart} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
