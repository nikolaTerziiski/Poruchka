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
import type { Recurrence } from "@poruchka/shared";
import { useTr, useCommon, useLang, type Lang } from "@/lib/i18n";

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

/** ISO weekday order (1 = Mon … 7 = Sun) for toggle labels, per language. */
const WEEKDAY_LABELS: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["Пон", "Вт", "Ср", "Чет", "Пет", "Съб", "Нед"],
};

/** Full weekday names used inside the recurrence sentence, per language. */
const WEEKDAY_FULL: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"],
};

/**
 * Localized recurrence label computed inline from the recurrence object.
 * bg uses gendered "Всеки/Всяка" before a weekday — "Всяка сряда", "Всеки ден",
 * "На всеки 14 дни".
 */
function localizedRecurrenceLabel(r: Recurrence, lang: Lang): string {
  if (lang === "bg") {
    if (r.type === "daily") return "Всеки ден";
    if (r.type === "interval") {
      const n = r.everyNDays;
      return n === 1 ? "Всеки ден" : `На всеки ${n} дни`;
    }
    if (r.type === "weekly") {
      if (r.weekdays.length === 7) return "Всеки ден";
      // "Всяка сряда" but "Всеки понеделник/вторник/…" — only сряда/събота/неделя are feminine.
      const feminine = new Set([3, 6, 7]); // сряда, събота, неделя
      return r.weekdays
        .map((d) => `${feminine.has(d) ? "Всяка" : "Всеки"} ${WEEKDAY_FULL.bg[d - 1]}`)
        .join(", ");
    }
    return "";
  }
  // en
  if (r.type === "daily") return "Every day";
  if (r.type === "interval") {
    const n = r.everyNDays;
    return n === 1 ? "Every day" : `Every ${n} days`;
  }
  if (r.type === "weekly") {
    if (r.weekdays.length === 7) return "Every day";
    return "Every " + r.weekdays.map((d) => WEEKDAY_FULL.en[d - 1]).join(", ");
  }
  return "";
}

const M = {
  en: {
    title: "Schedules",
    subtitle: "When each item is ordered, and who's responsible",
    newSchedule: "New schedule",
    addItemFirst: "Add an item first",
    loadFailed: "Failed to load schedules.",
    loadingSchedules: "Loading schedules…",
    emptyTitle: "No schedules yet",
    emptyDesc:
      "Tell Poruchka what to order and when — e.g. Pork Meat from Metro, every Wednesday at 09:00.",
    colItem: "Item",
    colRecurrence: "Recurrence",
    colTime: "Time",
    colResponsible: "Responsible",
    colActive: "Active",
    on: "On",
    paused: "Paused",
    pauseSchedule: "Pause schedule",
    activateSchedule: "Activate schedule",
    editSchedule: "Edit schedule",
    deleteScheduleAria: "Delete schedule",
    deleteTitle: "Delete this schedule?",
    deleteConfirm: "Delete schedule",
    dialogEditTitle: "Edit schedule",
    dialogNewTitle: "New schedule",
    saveChanges: "Save changes",
    createSchedule: "Create schedule",
    fieldItem: "Item",
    fieldResponsible: "Responsible",
    selectItem: "Select an item…",
    selectPerson: "Select a person…",
    recurrence: "Recurrence",
    modeDaily: "Daily",
    modeWeekly: "Weekly",
    modeInterval: "Every N days",
    every: "Every",
    days: "days",
    dailyHint: "A reminder will be sent every day at the time below.",
    reminderTime: "Reminder time",
    reminderTimeHint: "In the restaurant's timezone (Europe/Sofia)",
  },
  bg: {
    title: "Графици",
    subtitle: "Кога се поръчва всеки артикул и кой отговаря",
    newSchedule: "Нов график",
    addItemFirst: "Първо добавете артикул",
    loadFailed: "Неуспешно зареждане на графиците.",
    loadingSchedules: "Зареждане на графиците…",
    emptyTitle: "Все още няма графици",
    emptyDesc:
      "Кажете на Poruchka какво и кога да поръчва — напр. свинско месо от Метро, всяка сряда в 09:00.",
    colItem: "Артикул",
    colRecurrence: "Повторение",
    colTime: "Час",
    colResponsible: "Отговорник",
    colActive: "Активен",
    on: "Включен",
    paused: "На пауза",
    pauseSchedule: "Постави на пауза",
    activateSchedule: "Активирай графика",
    editSchedule: "Редактирай графика",
    deleteScheduleAria: "Изтрий графика",
    deleteTitle: "Да изтрием ли този график?",
    deleteConfirm: "Изтрий графика",
    dialogEditTitle: "Редактиране на график",
    dialogNewTitle: "Нов график",
    saveChanges: "Запази промените",
    createSchedule: "Създай график",
    fieldItem: "Артикул",
    fieldResponsible: "Отговорник",
    selectItem: "Изберете артикул…",
    selectPerson: "Изберете човек…",
    recurrence: "Повторение",
    modeDaily: "Ежедневно",
    modeWeekly: "Седмично",
    modeInterval: "На всеки N дни",
    every: "На всеки",
    days: "дни",
    dailyHint: "Напомняне ще се изпраща всеки ден в посочения по-долу час.",
    reminderTime: "Час за напомняне",
    reminderTimeHint: "В часовата зона на ресторанта (Europe/Sofia)",
  },
} as const;

export default function SchedulesPage() {
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
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
      setError(e instanceof Error ? e.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        title={t.title}
        subtitle={t.subtitle}
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
              {t.newSchedule}
            </Button>
            {noItems ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.addItemFirst}</span>
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
          {t.loadingSchedules}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Repeat size={22} />}
          title={t.emptyTitle}
          description={t.emptyDesc}
          action={
            <Button
              icon={<Plus size={16} />}
              disabled={noItems}
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              {t.newSchedule}
            </Button>
          }
        />
      ) : (
        <Table<Schedule>
          columns={[
            { key: "item", label: t.colItem },
            { key: "recurrence", label: t.colRecurrence },
            { key: "time", label: t.colTime, width: 90 },
            { key: "assignee", label: t.colResponsible },
            { key: "active", label: t.colActive, align: "center", width: 90 },
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
            if (key === "recurrence")
              return <Badge tone="accent">{localizedRecurrenceLabel(r.recurrence, lang)}</Badge>;
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
                  aria-label={r.active ? t.pauseSchedule : t.activateSchedule}
                >
                  {r.active ? <Badge tone="confirmed" dot>{t.on}</Badge> : <Badge tone="neutral">{t.paused}</Badge>}
                </button>
              );
            return (
              <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={15} />}
                  aria-label={t.editSchedule}
                  onClick={() => {
                    setCreating(false);
                    setEditing(r);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} color="var(--red-500)" />}
                  aria-label={t.deleteScheduleAria}
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
          title={t.deleteTitle}
          description={`${deleting.item.name} — ${localizedRecurrenceLabel(deleting.recurrence, lang)}`}
          confirmLabel={t.deleteConfirm}
          cancelLabel={c.cancel}
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
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
  const initialMode: Mode = schedule ? schedule.recurrence.type : "weekly";

  const modeOptions: [Mode, string][] = [
    ["daily", t.modeDaily],
    ["weekly", t.modeWeekly],
    ["interval", t.modeInterval],
  ];
  const weekdayLabels = WEEKDAY_LABELS[lang];

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
      title={schedule ? t.dialogEditTitle : t.dialogNewTitle}
      confirmLabel={schedule ? t.saveChanges : t.createSchedule}
      cancelLabel={c.cancel}
      width={520}
      confirmDisabled={confirmDisabled}
      busy={busy}
      onCancel={onClose}
      onConfirm={() => void handleConfirm()}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t.fieldItem}>
            <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="" disabled>
                {t.selectItem}
              </option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.fieldResponsible}>
            <Select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
              <option value="" disabled>
                {t.selectPerson}
              </option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t.recurrence}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {modeOptions.map(([k, l]) => (
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
              {weekdayLabels.map((d, i) => {
                const on = weekdays.includes(i + 1);
                return (
                  <button
                    key={i}
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
              <span style={{ fontSize: 14, color: "var(--text-body)" }}>{t.every}</span>
              <Input
                type="number"
                min={1}
                value={everyNDays}
                onChange={(e) => setEveryNDays(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 80 }}
              />
              <span style={{ fontSize: 14, color: "var(--text-body)" }}>{t.days}</span>
            </div>
          ) : null}

          {mode === "daily" ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              {t.dailyHint}
            </p>
          ) : null}
        </Field>

        <Field label={t.reminderTime} hint={t.reminderTimeHint}>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 140 }} />
        </Field>
      </div>
    </Dialog>
  );
}
