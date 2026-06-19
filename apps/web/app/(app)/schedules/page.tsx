"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Repeat } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { Field } from "@/components/ds/Field";
import { Select } from "@/components/ds/Select";
import { Badge } from "@/components/ds/Badge";
import { Table } from "@/components/ds/Table";
import { EmptyState } from "@/components/ds/EmptyState";
import { Dialog } from "@/components/ds/Dialog";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import { recurrenceLabel, WEEKDAYS } from "@/lib/recurrence";
import type { Recurrence } from "@poruchka/shared";

interface Schedule {
  id: string;
  reminderTimeOfDay: string;
  recurrence: Recurrence;
  active: boolean;
  item: { id: string; name: string; supplier: { name: string } };
  assignedUser: { id: string; name: string };
}

interface ItemOption {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
}

type Mode = "daily" | "weekly" | "interval";

const TODAY = new Date().toISOString().slice(0, 10);

const MODE_OPTIONS: [Mode, string][] = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["interval", "Every N days"],
];

export default function SchedulesPage() {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Schedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Schedule | null>(null);

  const refetch = useCallback(async () => {
    const data = await api<Schedule[]>("/schedules");
    setRows(data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedules, itemList, teamList] = await Promise.all([
        api<Schedule[]>("/schedules"),
        api<ItemOption[]>("/items"),
        api<TeamMember[]>("/team"),
      ]);
      setRows(schedules);
      setItems(itemList);
      setTeam(teamList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = useCallback(
    async (row: Schedule) => {
      await api(`/schedules/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !row.active }),
      });
      await refetch();
    },
    [refetch],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleting) return;
    await api(`/schedules/${deleting.id}`, { method: "DELETE" });
    await refetch();
    setDeleting(null);
  }, [deleting, refetch]);

  const dialogOpen = creating || editing !== null;
  const noItems = items.length === 0;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title="Schedules"
        subtitle="When each item is ordered, and who's responsible"
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <Button
              icon={<Plus size={16} />}
              disabled={noItems}
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              New schedule
            </Button>
            {noItems ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Add an item first</span>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div
          style={{
            background: "var(--status-escalated-bg)",
            border: "1px solid var(--status-escalated-bd)",
            color: "var(--status-escalated-fg)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            fontSize: 14,
            marginBottom: 18,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          Loading schedules…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Repeat size={22} />}
          title="No schedules yet"
          description="Tell Poruchka what to order and when — e.g. Pork Meat from Metro, every Wednesday at 09:00."
          action={
            <Button
              icon={<Plus size={16} />}
              disabled={noItems}
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              New schedule
            </Button>
          }
        />
      ) : (
        <Table<Schedule>
          columns={[
            { key: "item", label: "Item" },
            { key: "recurrence", label: "Recurrence" },
            { key: "time", label: "Time", width: 90 },
            { key: "assignee", label: "Responsible" },
            { key: "active", label: "Active", align: "center", width: 90 },
            { key: "actions", label: "", align: "right", width: 90 },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          renderCell={(r, key) => {
            if (key === "item")
              return (
                <span>
                  <span style={{ fontWeight: 600, color: "var(--text-strong)", display: "block" }}>{r.item.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.item.supplier.name}</span>
                </span>
              );
            if (key === "recurrence") return <Badge tone="accent">{recurrenceLabel(r.recurrence)}</Badge>;
            if (key === "time")
              return (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-body)" }}>
                  {r.reminderTimeOfDay}
                </span>
              );
            if (key === "assignee") return <span style={{ color: "var(--text-body)" }}>{r.assignedUser.name}</span>;
            if (key === "active")
              return (
                <button
                  type="button"
                  onClick={() => void toggleActive(r)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  aria-label={r.active ? "Pause schedule" : "Activate schedule"}
                >
                  {r.active ? <Badge tone="confirmed" dot>On</Badge> : <Badge tone="neutral">Paused</Badge>}
                </button>
              );
            return (
              <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={15} />}
                  aria-label="Edit schedule"
                  onClick={() => {
                    setCreating(false);
                    setEditing(r);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} color="var(--red-500)" />}
                  aria-label="Delete schedule"
                  onClick={() => setDeleting(r)}
                />
              </div>
            );
          }}
        />
      )}

      {dialogOpen ? (
        <ScheduleDialog
          schedule={editing}
          items={items}
          team={team}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await refetch();
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      {deleting ? (
        <Dialog
          tone="danger"
          title="Delete this schedule?"
          description={`${deleting.item.name} — ${recurrenceLabel(deleting.recurrence)}`}
          confirmLabel="Delete schedule"
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

function ScheduleDialog({
  schedule,
  items,
  team,
  onClose,
  onSaved,
}: {
  schedule: Schedule | null;
  items: ItemOption[];
  team: TeamMember[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const initialMode: Mode = schedule ? schedule.recurrence.type : "weekly";

  const [itemId, setItemId] = useState<string>(schedule?.item.id ?? "");
  const [assignedUserId, setAssignedUserId] = useState<string>(schedule?.assignedUser.id ?? "");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [weekdays, setWeekdays] = useState<number[]>(
    schedule && schedule.recurrence.type === "weekly" ? schedule.recurrence.weekdays : [3],
  );
  const [everyNDays, setEveryNDays] = useState<number>(
    schedule && schedule.recurrence.type === "interval" ? schedule.recurrence.everyNDays : 14,
  );
  const [time, setTime] = useState<string>(schedule?.reminderTimeOfDay ?? "09:00");
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: number) =>
    setWeekdays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)));

  const buildRecurrence = (): Recurrence => {
    if (mode === "daily") return { type: "daily" };
    if (mode === "interval")
      return { type: "interval", everyNDays: everyNDays || 1, anchorDate: TODAY };
    return { type: "weekly", weekdays };
  };

  const confirmDisabled = !itemId || !assignedUserId || (mode === "weekly" && weekdays.length === 0);

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    setBusy(true);
    try {
      const recurrence = buildRecurrence();
      if (schedule) {
        await api(`/schedules/${schedule.id}`, {
          method: "PATCH",
          body: JSON.stringify({ itemId, assignedUserId, reminderTimeOfDay: time, recurrence }),
        });
      } else {
        await api("/schedules", {
          method: "POST",
          body: JSON.stringify({ itemId, assignedUserId, reminderTimeOfDay: time, recurrence }),
        });
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={schedule ? "Edit schedule" : "New schedule"}
      confirmLabel={schedule ? "Save changes" : "Create schedule"}
      width={520}
      confirmDisabled={confirmDisabled}
      busy={busy}
      onCancel={onClose}
      onConfirm={() => void handleConfirm()}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Item">
            <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="" disabled>
                Select an item…
              </option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsible">
            <Select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
              <option value="" disabled>
                Select a person…
              </option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Recurrence">
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {MODE_OPTIONS.map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${mode === k ? "var(--brand-300)" : "var(--border-default)"}`,
                  background: mode === k ? "var(--brand-50)" : "var(--surface-card)",
                  color: mode === k ? "var(--brand-700)" : "var(--text-body)",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {mode === "weekly" ? (
            <div style={{ display: "flex", gap: 6 }}>
              {WEEKDAYS.map((d, i) => {
                const on = weekdays.includes(i + 1);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i + 1)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--radius-md)",
                      fontFamily: "var(--font-sans)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${on ? "var(--accent)" : "var(--border-default)"}`,
                      background: on ? "var(--accent)" : "var(--surface-card)",
                      color: on ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          ) : null}

          {mode === "interval" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, color: "var(--text-body)" }}>Every</span>
              <Input
                type="number"
                min={1}
                value={everyNDays}
                onChange={(e) => setEveryNDays(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 80 }}
              />
              <span style={{ fontSize: 14, color: "var(--text-body)" }}>days</span>
            </div>
          ) : null}

          {mode === "daily" ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              A reminder will be sent every day at the time below.
            </p>
          ) : null}
        </Field>

        <Field label="Reminder time" hint="In the restaurant's timezone (Europe/Sofia)">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 140 }} />
        </Field>
      </div>
    </Dialog>
  );
}
