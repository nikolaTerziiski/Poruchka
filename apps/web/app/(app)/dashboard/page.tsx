"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { useTr, useLang, type Lang } from "@/lib/i18n";

const LABELS = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["Пон", "Вт", "Ср", "Чет", "Пет", "Съб", "Нед"],
} as const;

const M = {
  en: {
    title: "Order calendar",
    weekOf: (range: string) => `Week of ${range}`,
    today: "Today",
    prevWeek: "Previous week",
    nextWeek: "Next week",
    statPending: "Pending today & ahead",
    statSubmitted: "Submitted this week",
    statEscalated: "Escalated - needs attention",
    statSkipped: "Skipped",
    emptyTitle: "No supplier orders this week",
    emptyDesc: "Create a supplier reminder, e.g. Metro every Wednesday with the items to check before ordering.",
    createPlan: "Create order plan",
    item: "item",
    items: "items",
    usual: "usual",
  },
  bg: {
    title: "Календар на поръчките",
    weekOf: (range: string) => `Седмица ${range}`,
    today: "Днес",
    prevWeek: "Предходна седмица",
    nextWeek: "Следваща седмица",
    statPending: "Предстоящи",
    statSubmitted: "Подадени тази седмица",
    statEscalated: "Ескалирани",
    statSkipped: "Пропуснати",
    emptyTitle: "Няма поръчки към доставчици тази седмица",
    emptyDesc: "Създайте напомняне към доставчик, напр. Метро всяка сряда с артикулите за проверка преди поръчка.",
    createPlan: "Създай план",
    item: "артикул",
    items: "артикула",
    usual: "обичайно",
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
  expectedDeliveryDate: string | null;
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
  const days = LABELS[lang].map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d.getDate(), iso: toISODate(d), isToday: d.toDateString() === today.toDateString() };
  });
  const month = monday.toLocaleString(lang === "bg" ? "bg-BG" : "en-US", { month: "long" });
  return { days, rangeLabel: `${monday.getDate()}-${days[6].date} ${month}` };
}

function statusTone(status: string): "pending" | "confirmed" | "escalated" {
  if (status === "submitted") return "confirmed";
  if (status === "escalated" || status === "skipped") return "escalated";
  return "pending";
}

function formatLine(line: OrderLine, usual: string) {
  const qty = line.quantity != null ? ` (${usual}: ${line.quantity}${line.unit ? ` ${line.unit}` : ""})` : "";
  return `${line.item}${qty}`;
}

function SummaryStat({ tone, n, label }: { tone: "pending" | "confirmed" | "escalated"; n: number; label: string }) {
  return (
    <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "14px 18px", boxShadow: "var(--shadow-xs)" }}>
      <span style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `var(--status-${tone}-bg)`, border: `1px solid var(--status-${tone}-bd)`, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: `var(--status-${tone}-dot)` }} />
      </span>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1 }}>{n}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

function OrderChip({ order, labels }: { order: OrderOccurrence; labels: { item: string; items: string; usual: string } }) {
  const tone = statusTone(order.status);
  const preview = order.lines.slice(0, 2).map((line) => formatLine(line, labels.usual)).join(", ");
  const extra = order.lines.length > 2 ? ` +${order.lines.length - 2}` : "";
  return (
    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--surface-card)", padding: "9px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: `var(--status-${tone}-dot)`, flex: "none" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-muted)" }}>{order.time}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.25 }}>{order.supplier}</div>
      <div style={{ fontSize: 12, color: "var(--text-body)", marginTop: 3, lineHeight: 1.3 }}>{preview}{extra}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
        {order.lines.length} {order.lines.length === 1 ? labels.item : labels.items} · {order.assignee.split("@")[0].split(" ")[0]}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const t = useTr(M);
  const lang = useLang();
  const { days, rangeLabel } = computeWeek(lang);
  const [orders, setOrders] = useState<OrderOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

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

  const byDate: Record<string, OrderOccurrence[]> = {};
  for (const order of orders) (byDate[order.date] ??= []).push(order);
  const counts = {
    pending: orders.filter((order) => order.status === "pending").length,
    submitted: orders.filter((order) => order.status === "submitted").length,
    escalated: orders.filter((order) => order.status === "escalated").length,
    skipped: orders.filter((order) => order.status === "skipped").length,
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.weekOf(rangeLabel)}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="md" icon={<ChevronLeft size={16} />} aria-label={t.prevWeek} />
            <Button variant="secondary" size="md">{t.today}</Button>
            <Button variant="secondary" size="md" icon={<ChevronRight size={16} />} aria-label={t.nextWeek} />
          </div>
        }
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <SummaryStat tone="pending" n={counts.pending} label={t.statPending} />
        <SummaryStat tone="confirmed" n={counts.submitted} label={t.statSubmitted} />
        <SummaryStat tone="escalated" n={counts.escalated + counts.skipped} label={`${t.statEscalated} / ${t.statSkipped}`} />
      </div>

      {!loading && orders.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "18px 20px", marginBottom: 22, boxShadow: "var(--shadow-xs)", flexWrap: "wrap" }}>
          <span style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--brand-50)", border: "1px solid var(--brand-100)", color: "var(--brand-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <CalendarPlus size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>{t.emptyTitle}</div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>{t.emptyDesc}</div>
          </div>
          <Button variant="primary" size="md" onClick={() => router.push("/schedules")}>{t.createPlan}</Button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(132px, 1fr))", gap: 10 }}>
          {days.map((day) => {
            const dayOrders = byDate[day.iso] ?? [];
            return (
              <div
                key={day.label}
                style={{
                  background: day.isToday ? "var(--brand-50)" : "var(--surface-sunken)",
                  border: day.isToday ? "1px solid var(--brand-200)" : "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: 10,
                  minHeight: 190,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: day.isToday ? "var(--brand-700)" : "var(--text-muted)" }}>{day.label}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: day.isToday ? "var(--brand-700)" : "var(--text-strong)" }}>{day.date}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {dayOrders.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--text-faint)", padding: "4px 2px" }}>-</span>
                  ) : (
                    dayOrders.map((order, i) => (
                      <OrderChip key={`${order.orderRuleId}-${order.date}-${i}`} order={order} labels={{ item: t.item, items: t.items, usual: t.usual }} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
