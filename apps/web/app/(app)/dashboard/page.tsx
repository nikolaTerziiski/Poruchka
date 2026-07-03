"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, CheckCircle2, ClipboardList, Clock, Send } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { useTr, useLang, type Lang } from "@/lib/i18n";

const DAY_LABELS = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["Пон", "Вт", "Ср", "Чет", "Пет", "Съб", "Нед"],
} as const;

const M = {
  en: {
    title: "Today",
    ordersToday: (n: number) => (n === 1 ? "1 order today" : `${n} orders today`),
    needsAttention: (n: number) => (n === 1 ? "1 needs attention" : `${n} need attention`),
    allClear: "all confirmed",
    viewPlans: "Order plans",
    escalatedRow: (supplier: string) => `${supplier} — no response, escalated`,
    statusPending: "Pending",
    statusSubmitted: "Done",
    statusEscalated: "Escalated",
    statusSkipped: "Skipped",
    cutoff: (t: string) => `order by ${t}`,
    item: "item",
    items: "items",
    usual: "usual",
    more: (n: number) => `+${n} more`,
    scheduledFor: (t: string) => `Reminder scheduled for ${t}`,
    sentAt: (t: string) => `Sent ${t}`,
    postponedTo: (t: string) => `postponed to ${t}`,
    nextNudge: (t: string) => `next nudge ${t}`,
    confirmedAt: (t: string) => `Confirmed ${t}`,
    confirmedBy: (name: string) => `by ${name}`,
    escalatedAfter: (n: number) => `escalated after ${n === 1 ? "1 nudge" : `${n} nudges`}`,
    skippedNote: "Skipped — no order was placed",
    deliveryExpected: (d: string) => `delivery expected ${d}`,
    emptyDayTitle: "No orders on this day",
    emptyDayNext: (supplier: string, day: string) => `Next up: ${supplier} on ${day}`,
    emptyWeekTitle: "No supplier orders planned yet",
    emptyWeekDesc: "Create a supplier order plan, e.g. Metro every Wednesday with the items to check before ordering.",
    createPlan: "Create order plan",
    thisWeek: "This week",
  },
  bg: {
    title: "Днес",
    ordersToday: (n: number) => (n === 1 ? "1 поръчка днес" : `${n} поръчки днес`),
    needsAttention: (n: number) => (n === 1 ? "1 изисква внимание" : `${n} изискват внимание`),
    allClear: "всички потвърдени",
    viewPlans: "Планове",
    escalatedRow: (supplier: string) => `${supplier} — няма отговор, ескалирана`,
    statusPending: "Предстои",
    statusSubmitted: "Готово",
    statusEscalated: "Ескалирана",
    statusSkipped: "Пропусната",
    cutoff: (t: string) => `подайте до ${t}`,
    item: "артикул",
    items: "артикула",
    usual: "обичайно",
    more: (n: number) => `+${n} още`,
    scheduledFor: (t: string) => `Напомнянето е насрочено за ${t}`,
    sentAt: (t: string) => `Изпратено ${t}`,
    postponedTo: (t: string) => `отложено за ${t}`,
    nextNudge: (t: string) => `следващо напомняне ${t}`,
    confirmedAt: (t: string) => `Потвърдено ${t}`,
    confirmedBy: (name: string) => `от ${name}`,
    escalatedAfter: (n: number) => `ескалирана след ${n === 1 ? "1 напомняне" : `${n} напомняния`}`,
    skippedNote: "Пропусната — не е подадена поръчка",
    deliveryExpected: (d: string) => `очаквана доставка ${d}`,
    emptyDayTitle: "Няма поръчки за този ден",
    emptyDayNext: (supplier: string, day: string) => `Следва: ${supplier} в ${day}`,
    emptyWeekTitle: "Все още няма планирани поръчки",
    emptyWeekDesc: "Създайте план към доставчик, напр. Метро всяка сряда с артикулите за проверка преди поръчка.",
    createPlan: "Създай план",
    thisWeek: "Тази седмица",
  },
} as const;

interface OrderLine {
  item: string;
  quantity: number | null;
  unit: string | null;
}

interface OrderOccurrence {
  date: string;
  orderRuleId: string;
  supplier: string;
  assignee: string;
  time: string;
  status: "pending" | "submitted" | "escalated" | "skipped" | string;
  cutoffTime: string | null;
  expectedDeliveryDate: string | null;
  sentCount: number;
  lastSentAt: string | null;
  nextNudgeAt: string | null;
  postponedCount: number;
  postponedUntil: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  lines: OrderLine[];
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeWeek(lang: Lang) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayOffset);
  return DAY_LABELS[lang].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d.getDate(), iso: toISODate(d), isToday: d.toDateString() === today.toDateString() };
  });
}

function locale(lang: Lang) {
  return lang === "bg" ? "bg-BG" : "en-GB";
}

/** "14:05", or "Чет 14:05" when the instant falls on another day. */
function fmtWhen(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const clock = d.toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return clock;
  return `${d.toLocaleDateString(locale(lang), { weekday: "short" })} ${clock}`;
}

function fmtDayName(iso: string, lang: Lang): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale(lang), { weekday: "long" });
}

function statusTone(status: string): "pending" | "confirmed" | "escalated" | "neutral" {
  if (status === "submitted") return "confirmed";
  if (status === "escalated") return "escalated";
  if (status === "skipped") return "neutral";
  return "pending";
}

function linesPreview(o: OrderOccurrence, t: { usual: string; more: (n: number) => string }): string {
  const shown = o.lines.slice(0, 3).map((l) => {
    const qty = l.quantity != null ? ` (${t.usual}: ${l.quantity}${l.unit ? ` ${l.unit}` : ""})` : "";
    return `${l.item}${qty}`;
  });
  const extra = o.lines.length > 3 ? ` ${t.more(o.lines.length - 3)}` : "";
  return shown.join(", ") + extra;
}

/** One-line live history of the reminder loop for an occurrence. */
function Timeline({ o, lang }: { o: OrderOccurrence; lang: Lang }) {
  const t = useTr(M);
  const parts: { Icon: typeof Send; text: string; tone?: string }[] = [];

  if (o.status === "skipped") {
    parts.push({ Icon: Clock, text: t.skippedNote });
  } else if (o.sentCount === 0) {
    parts.push({ Icon: Clock, text: t.scheduledFor(o.time) });
  } else {
    if (o.lastSentAt) parts.push({ Icon: Send, text: t.sentAt(fmtWhen(o.lastSentAt, lang)) });
    if (o.status === "submitted" && o.submittedAt) {
      parts.push({
        Icon: CheckCircle2,
        text: `${t.confirmedAt(fmtWhen(o.submittedAt, lang))}${o.submittedBy ? ` ${t.confirmedBy(o.submittedBy)}` : ""}`,
        tone: "var(--status-confirmed-dot)",
      });
    } else if (o.status === "escalated") {
      parts.push({ Icon: AlertTriangle, text: t.escalatedAfter(o.sentCount), tone: "var(--status-escalated-dot)" });
    } else {
      if (o.postponedUntil) parts.push({ Icon: Clock, text: t.postponedTo(fmtWhen(o.postponedUntil, lang)) });
      else if (o.nextNudgeAt) parts.push({ Icon: Clock, text: t.nextNudge(fmtWhen(o.nextNudgeAt, lang)) });
    }
  }
  if (o.status === "submitted" && o.expectedDeliveryDate) {
    parts.push({ Icon: ClipboardList, text: t.deliveryExpected(fmtDayName(o.expectedDeliveryDate, lang)) });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 9, fontSize: 12, color: "var(--text-muted)" }}>
      {parts.map((p, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          {i > 0 ? <span style={{ color: "var(--text-faint)", margin: "0 2px" }}>·</span> : null}
          <p.Icon size={13} color={p.tone ?? "var(--text-faint)"} />
          {p.text}
        </span>
      ))}
    </div>
  );
}

type Messages = (typeof M)["en"] | (typeof M)["bg"];

function statusLabel(status: string, t: Messages): string {
  if (status === "submitted") return t.statusSubmitted;
  if (status === "escalated") return t.statusEscalated;
  if (status === "skipped") return t.statusSkipped;
  return t.statusPending;
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTr(M);
  const lang = useLang();
  const days = useMemo(() => computeWeek(lang), [lang]);
  const todayIso = days.find((d) => d.isToday)?.iso ?? days[0].iso;
  const [orders, setOrders] = useState<OrderOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIso, setSelectedIso] = useState(todayIso);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<OrderOccurrence[]>(`/orders?from=${days[0].iso}&to=${days[6].iso}`);
        if (!cancelled) setOrders(data);
      } catch {
        /* leave empty on error */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byDate = useMemo(() => {
    const map: Record<string, OrderOccurrence[]> = {};
    for (const order of orders) (map[order.date] ??= []).push(order);
    return map;
  }, [orders]);

  const todayOrders = byDate[todayIso] ?? [];
  const dayOrders = byDate[selectedIso] ?? [];
  const escalated = orders.filter((o) => o.status === "escalated" && o.date <= todayIso);
  const confirmedToday = todayOrders.filter((o) => o.status === "submitted").length;

  const attentionNote =
    escalated.length > 0
      ? t.needsAttention(escalated.length)
      : todayOrders.length > 0 && confirmedToday === todayOrders.length
        ? t.allClear
        : null;

  const selectedDay = days.find((d) => d.iso === selectedIso);
  const nextUpcoming = orders.find((o) => o.date > selectedIso && o.status === "pending");

  const headline = new Date().toLocaleDateString(locale(lang), { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={`${headline} · ${t.ordersToday(todayOrders.length)}${attentionNote ? ` · ${attentionNote}` : ""}`}
        action={
          <Button variant="secondary" size="md" icon={<ClipboardList size={16} />} onClick={() => router.push("/orders")}>
            {t.viewPlans}
          </Button>
        }
      />

      {escalated.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {escalated.map((o, i) => (
            <button
              key={`${o.orderRuleId}-${o.date}-${i}`}
              onClick={() => setSelectedIso(o.date)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                background: "var(--status-escalated-bg)",
                border: "1px solid var(--status-escalated-bd)",
                borderRadius: "var(--radius-lg)",
                padding: "11px 14px",
              }}
            >
              <AlertTriangle size={16} color="var(--status-escalated-dot)" style={{ flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--status-escalated-fg)" }}>
                {t.escalatedRow(o.supplier)}
                <span style={{ opacity: 0.75 }}> — {o.date === todayIso ? o.time : `${fmtDayName(o.date, lang)} ${o.time}`} · {o.assignee}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, marginBottom: 20 }}>
        {days.map((day) => {
          const list = byDate[day.iso] ?? [];
          const selected = day.iso === selectedIso;
          return (
            <button
              key={day.iso}
              onClick={() => setSelectedIso(day.iso)}
              style={{
                cursor: "pointer",
                textAlign: "center",
                padding: "8px 4px",
                borderRadius: "var(--radius-md)",
                border: selected ? "1px solid var(--brand-300)" : "1px solid var(--border-subtle)",
                background: selected ? "var(--brand-50)" : day.isToday ? "var(--surface-card)" : "var(--surface-sunken)",
              }}
              aria-pressed={selected}
            >
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: selected || day.isToday ? "var(--brand-700)" : "var(--text-muted)" }}>
                {day.label} {day.date}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 6, minHeight: 7 }}>
                {list.slice(0, 4).map((o, i) => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--status-${statusTone(o.status) === "neutral" ? "pending" : statusTone(o.status)}-dot)`, opacity: o.status === "skipped" ? 0.35 : 1 }} />
                ))}
                {list.length === 0 ? <span style={{ fontSize: 10.5, color: "var(--text-faint)", lineHeight: "7px" }}>–</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      {!loading && orders.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "18px 20px", boxShadow: "var(--shadow-xs)", flexWrap: "wrap" }}>
          <span style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--brand-50)", border: "1px solid var(--brand-100)", color: "var(--brand-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <CalendarPlus size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>{t.emptyWeekTitle}</div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>{t.emptyWeekDesc}</div>
          </div>
          <Button variant="primary" size="md" onClick={() => router.push("/orders")}>{t.createPlan}</Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {selectedIso !== todayIso && selectedDay ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "capitalize" }}>
              {fmtDayName(selectedIso, lang)} {selectedDay.date}
            </div>
          ) : null}
          {dayOrders.length === 0 && !loading ? (
            <div style={{ background: "var(--surface-sunken)", border: "1px dashed var(--border-default)", borderRadius: "var(--radius-xl)", padding: "18px 20px", fontSize: 13.5, color: "var(--text-muted)" }}>
              {t.emptyDayTitle}
              {nextUpcoming ? <span> · {t.emptyDayNext(nextUpcoming.supplier, fmtDayName(nextUpcoming.date, lang))}</span> : null}
            </div>
          ) : (
            dayOrders.map((o, i) => (
              <div key={`${o.orderRuleId}-${o.date}-${i}`} style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "14px 18px", boxShadow: "var(--shadow-xs)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>{o.supplier}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{o.time}</span>
                  </span>
                  <Badge tone={statusTone(o.status)} dot size="md">
                    {statusLabel(o.status, t)}
                    {o.status === "pending" && o.cutoffTime ? ` · ${t.cutoff(o.cutoffTime)}` : ""}
                  </Badge>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-body)", marginTop: 6, lineHeight: 1.45 }}>
                  {linesPreview(o, t)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  {o.lines.length} {o.lines.length === 1 ? t.item : t.items} · {o.assignee}
                </div>
                <Timeline o={o} lang={lang} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
