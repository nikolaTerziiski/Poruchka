"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { PageHead } from "@/components/ds/PageHead";

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function computeWeek() {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayOffset);
  const days = LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, date: d.getDate(), isToday: d.toDateString() === today.toDateString() };
  });
  const sunday = days[6];
  const month = monday.toLocaleString("en-US", { month: "long" });
  return { days, rangeLabel: `${monday.getDate()}–${sunday.date} ${month}` };
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

export default function DashboardPage() {
  const router = useRouter();
  const { days, rangeLabel } = computeWeek();

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title="Order calendar"
        subtitle={`Week of ${rangeLabel}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="md" icon={<ChevronLeft size={16} />} aria-label="Previous week" />
            <Button variant="secondary" size="md">Today</Button>
            <Button variant="secondary" size="md" icon={<ChevronRight size={16} />} aria-label="Next week" />
          </div>
        }
      />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <SummaryStat tone="pending" n={0} label="Pending today & ahead" />
        <SummaryStat tone="confirmed" n={0} label="Confirmed this week" />
        <SummaryStat tone="escalated" n={0} label="Escalated — needs attention" />
      </div>

      {/* Empty state */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: "18px 20px", marginBottom: 22, boxShadow: "var(--shadow-xs)", flexWrap: "wrap" }}>
        <span style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--brand-50)", border: "1px solid var(--brand-100)", color: "var(--brand-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <CalendarPlus size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>No orders scheduled yet</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>
            Add your suppliers and items, then create a schedule (e.g. Pork Meat from Metro, every Wednesday) — reminders will show up here.
          </div>
        </div>
        <Button variant="primary" size="md" onClick={() => router.push("/schedules")}>Create a schedule</Button>
      </div>

      {/* Week grid */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", gap: 10 }}>
          {days.map((day) => (
            <div
              key={day.label}
              style={{
                background: day.isToday ? "var(--brand-50)" : "var(--surface-sunken)",
                border: day.isToday ? "1px solid var(--brand-200)" : "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: 10,
                minHeight: 180,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: day.isToday ? "var(--brand-700)" : "var(--text-muted)" }}>{day.label}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: day.isToday ? "var(--brand-700)" : "var(--text-strong)" }}>{day.date}</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-faint)", padding: "4px 2px" }}>—</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
