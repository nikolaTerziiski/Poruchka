"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Repeat, X } from "lucide-react";
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

interface Supplier {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  unit: string | null;
  notes: string | null;
  supplierId: string;
  supplier: { id: string; name: string };
}

interface TeamMember {
  id: string;
  name: string;
}

interface OrderRuleLine {
  id: string;
  itemId: string;
  defaultQuantity: number | null;
  unit: string | null;
  notes: string | null;
  sortOrder: number;
  item: { id: string; name: string; unit: string | null };
}

interface OrderRule {
  id: string;
  supplierId: string;
  assignedUserId: string;
  escalationUserId: string | null;
  reminderTimeOfDay: string;
  recurrence: Recurrence;
  cutoffTime: string | null;
  expectedDeliveryOffsetDays: number | null;
  active: boolean;
  supplier: Supplier;
  assignedUser: TeamMember;
  escalationUser: TeamMember | null;
  lines: OrderRuleLine[];
}

interface DraftLine {
  itemId: string;
  defaultQuantity: string;
  unit: string;
  notes: string;
}

type Mode = "daily" | "weekly" | "interval";

const TODAY = new Date().toISOString().slice(0, 10);

const WEEKDAY_LABELS: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["Пон", "Вт", "Ср", "Чет", "Пет", "Съб", "Нед"],
};

const WEEKDAY_FULL: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"],
};

function recurrenceLabel(r: Recurrence, lang: Lang): string {
  if (r.type === "daily") return lang === "bg" ? "Всеки ден" : "Every day";
  if (r.type === "interval") {
    if (r.everyNDays === 1) return lang === "bg" ? "Всеки ден" : "Every day";
    return lang === "bg" ? `На всеки ${r.everyNDays} дни` : `Every ${r.everyNDays} days`;
  }
  if (r.weekdays.length === 7) return lang === "bg" ? "Всеки ден" : "Every day";
  return (lang === "bg" ? "Всеки " : "Every ") + r.weekdays.map((d) => WEEKDAY_FULL[lang][d - 1]).join(", ");
}

function lineSummary(lines: OrderRuleLine[], empty: string): string {
  if (!lines.length) return empty;
  const names = lines.slice(0, 3).map((l) => l.item.name).join(", ");
  return lines.length > 3 ? `${names} +${lines.length - 3}` : names;
}

const M = {
  en: {
    title: "Order plans",
    subtitle: "Supplier reminders with item checklists",
    newPlan: "New supplier reminder",
    addBasicsFirst: "Add a supplier, item, and team member first",
    loadFailed: "Failed to load order plans.",
    loading: "Loading order plans...",
    emptyTitle: "No order plans yet",
    emptyDesc: "Add the items this supplier order should remind you to check.",
    colSupplier: "Supplier",
    colItems: "Items",
    colRecurrence: "Recurrence",
    colTime: "Time",
    colResponsible: "Responsible",
    colActive: "Active",
    on: "On",
    paused: "Paused",
    pause: "Pause order plan",
    activate: "Activate order plan",
    edit: "Edit order plan",
    deleteAria: "Archive order plan",
    archiveTitle: "Archive this order plan?",
    archiveDesc: "Future reminders stop, but existing order history stays visible.",
    archiveConfirm: "Archive plan",
    dialogEditTitle: "Edit order plan",
    dialogNewTitle: "New order plan",
    saveChanges: "Save changes",
    createPlan: "Create plan",
    supplier: "Supplier",
    responsible: "Responsible",
    escalation: "Escalation person",
    optional: "Optional",
    selectSupplier: "Select supplier...",
    selectPerson: "Select person...",
    noEscalation: "No escalation person",
    lines: "Items to check",
    addLine: "Add item",
    item: "Item",
    quantity: "Usual qty",
    unit: "Unit",
    note: "Note",
    removeLine: "Remove item",
    recurrence: "Recurrence",
    modeDaily: "Daily",
    modeWeekly: "Weekly",
    modeInterval: "Every N days",
    every: "Every",
    days: "days",
    reminderTime: "Reminder time",
    cutoffTime: "Cutoff time",
    deliveryOffset: "Delivery offset days",
    none: "None",
  },
  bg: {
    title: "Планове за поръчки",
    subtitle: "Напомняния към доставчици със списък за проверка",
    newPlan: "Ново напомняне",
    addBasicsFirst: "Първо добавете доставчик, артикул и член на екипа",
    loadFailed: "Неуспешно зареждане на плановете.",
    loading: "Зареждане на плановете...",
    emptyTitle: "Все още няма планове",
    emptyDesc: "Добавете артикулите, за които тази поръчка към доставчик трябва да ви подсеща.",
    colSupplier: "Доставчик",
    colItems: "Артикули",
    colRecurrence: "Повторение",
    colTime: "Час",
    colResponsible: "Отговорник",
    colActive: "Активен",
    on: "Включен",
    paused: "На пауза",
    pause: "Постави плана на пауза",
    activate: "Активирай плана",
    edit: "Редактирай плана",
    deleteAria: "Архивирай плана",
    archiveTitle: "Да архивираме ли този план?",
    archiveDesc: "Бъдещите напомняния спират, но историята на поръчките остава видима.",
    archiveConfirm: "Архивирай",
    dialogEditTitle: "Редактиране на план",
    dialogNewTitle: "Нов план",
    saveChanges: "Запази",
    createPlan: "Създай план",
    supplier: "Доставчик",
    responsible: "Отговорник",
    escalation: "Ескалация към",
    optional: "По избор",
    selectSupplier: "Изберете доставчик...",
    selectPerson: "Изберете човек...",
    noEscalation: "Без ескалация",
    lines: "Артикули за проверка",
    addLine: "Добави артикул",
    item: "Артикул",
    quantity: "Обичайно кол. (по желание)",
    unit: "Мярка",
    note: "Бележка",
    removeLine: "Премахни артикул",
    recurrence: "Повторение",
    modeDaily: "Ежедневно",
    modeWeekly: "Седмично",
    modeInterval: "На всеки N дни",
    every: "На всеки",
    days: "дни",
    reminderTime: "Час за напомняне",
    cutoffTime: "Краен час",
    deliveryOffset: "Дни до доставка",
    none: "Няма",
  },
} as const;

export default function SchedulesPage() {
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
  const [rules, setRules] = useState<OrderRule[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<OrderRule | null>(null);

  const refetch = useCallback(async () => {
    setRules(await api<OrderRule[]>("/order-rules"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ruleList, supplierList, itemList, teamList] = await Promise.all([
        api<OrderRule[]>("/order-rules"),
        api<Supplier[]>("/suppliers"),
        api<Item[]>("/items"),
        api<TeamMember[]>("/team"),
      ]);
      setRules(ruleList);
      setSuppliers(supplierList);
      setItems(itemList);
      setTeam(teamList);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const missingBasics = suppliers.length === 0 || items.length === 0 || team.length === 0;

  async function toggleActive(rule: OrderRule) {
    await api(`/order-rules/${rule.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !rule.active }),
    });
    await refetch();
  }

  async function confirmArchive() {
    if (!archiving) return;
    await api(`/order-rules/${archiving.id}`, { method: "DELETE" });
    setArchiving(null);
    await refetch();
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <Button
              icon={<Plus size={16} />}
              disabled={missingBasics}
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              {t.newPlan}
            </Button>
            {missingBasics ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.addBasicsFirst}</span> : null}
          </div>
        }
      />

      {error ? (
        <div style={{ color: "var(--red-600)", fontSize: 14, marginBottom: 16 }}>{error}</div>
      ) : null}

      {loading ? (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {t.loading}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Repeat size={22} />}
          title={t.emptyTitle}
          description={t.emptyDesc}
          action={
            <Button
              icon={<Plus size={16} />}
              disabled={missingBasics}
              onClick={() => {
                setEditing(null);
                setCreating(true);
              }}
            >
              {t.newPlan}
            </Button>
          }
        />
      ) : (
        <Table<OrderRule>
          columns={[
            { key: "supplier", label: t.colSupplier },
            { key: "items", label: t.colItems },
            { key: "recurrence", label: t.colRecurrence },
            { key: "time", label: t.colTime, width: 110 },
            { key: "assignee", label: t.colResponsible },
            { key: "active", label: t.colActive, align: "center", width: 90 },
            { key: "actions", label: "", align: "right", width: 90 },
          ]}
          rows={rules}
          rowKey={(r) => r.id}
          renderCell={(r, key) => {
            if (key === "supplier") return <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{r.supplier.name}</span>;
            if (key === "items")
              return (
                <span>
                  <span style={{ display: "block", color: "var(--text-body)" }}>{lineSummary(r.lines, t.none)}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.lines.length} item{r.lines.length === 1 ? "" : "s"}</span>
                </span>
              );
            if (key === "recurrence") return <Badge tone="accent">{recurrenceLabel(r.recurrence, lang)}</Badge>;
            if (key === "time")
              return (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-body)" }}>
                  {r.reminderTimeOfDay}
                  {r.cutoffTime ? <span style={{ color: "var(--text-muted)" }}> / {r.cutoffTime}</span> : null}
                </span>
              );
            if (key === "assignee") return <span style={{ color: "var(--text-body)" }}>{r.assignedUser.name}</span>;
            if (key === "active")
              return (
                <button
                  type="button"
                  onClick={() => void toggleActive(r)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  aria-label={r.active ? t.pause : t.activate}
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
                  aria-label={t.edit}
                  onClick={() => {
                    setCreating(false);
                    setEditing(r);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} color="var(--red-500)" />}
                  aria-label={t.deleteAria}
                  onClick={() => setArchiving(r)}
                />
              </div>
            );
          }}
        />
      )}

      {creating || editing ? (
        <OrderPlanDialog
          rule={editing}
          suppliers={suppliers}
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

      {archiving ? (
        <Dialog
          tone="danger"
          title={t.archiveTitle}
          description={`${archiving.supplier.name} - ${lineSummary(archiving.lines, t.none)}. ${t.archiveDesc}`}
          confirmLabel={t.archiveConfirm}
          cancelLabel={c.cancel}
          onCancel={() => setArchiving(null)}
          onConfirm={() => void confirmArchive()}
        />
      ) : null}
    </div>
  );
}

function OrderPlanDialog({
  rule,
  suppliers,
  items,
  team,
  onClose,
  onSaved,
}: {
  rule: OrderRule | null;
  suppliers: Supplier[];
  items: Item[];
  team: TeamMember[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
  const initialMode: Mode = rule ? rule.recurrence.type : "weekly";
  const [supplierId, setSupplierId] = useState(rule?.supplierId ?? suppliers[0]?.id ?? "");
  const [assignedUserId, setAssignedUserId] = useState(rule?.assignedUserId ?? team[0]?.id ?? "");
  const [escalationUserId, setEscalationUserId] = useState(rule?.escalationUserId ?? "");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [weekdays, setWeekdays] = useState<number[]>(
    rule && rule.recurrence.type === "weekly" ? rule.recurrence.weekdays : [3],
  );
  const [everyNDays, setEveryNDays] = useState(
    rule && rule.recurrence.type === "interval" ? rule.recurrence.everyNDays : 14,
  );
  const [time, setTime] = useState(rule?.reminderTimeOfDay ?? "09:00");
  const [cutoffTime, setCutoffTime] = useState(rule?.cutoffTime ?? "");
  const [deliveryOffset, setDeliveryOffset] = useState(
    rule?.expectedDeliveryOffsetDays != null ? String(rule.expectedDeliveryOffsetDays) : "",
  );
  const [lines, setLines] = useState<DraftLine[]>(
    rule?.lines.map((l) => ({
      itemId: l.itemId,
      defaultQuantity: l.defaultQuantity != null ? String(l.defaultQuantity) : "",
      unit: l.unit ?? l.item.unit ?? "",
      notes: l.notes ?? "",
    })) ?? [{ itemId: "", defaultQuantity: "", unit: "", notes: "" }],
  );
  const [busy, setBusy] = useState(false);

  const supplierItems = useMemo(() => items.filter((i) => i.supplierId === supplierId), [items, supplierId]);

  function updateSupplier(nextSupplierId: string) {
    setSupplierId(nextSupplierId);
    const first = items.find((i) => i.supplierId === nextSupplierId);
    setLines([{ itemId: first?.id ?? "", defaultQuantity: "", unit: first?.unit ?? "", notes: first?.notes ?? "" }]);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.itemId) {
          const item = items.find((candidate) => candidate.id === patch.itemId);
          next.unit = item?.unit ?? "";
          next.notes = item?.notes ?? "";
        }
        return next;
      }),
    );
  }

  function addLine() {
    const firstUnused = supplierItems.find((item) => !lines.some((line) => line.itemId === item.id));
    setLines((current) => [
      ...current,
      { itemId: firstUnused?.id ?? "", defaultQuantity: "", unit: firstUnused?.unit ?? "", notes: firstUnused?.notes ?? "" },
    ]);
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_line, i) => i !== index)));
  }

  function toggleDay(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b),
    );
  }

  function buildRecurrence(): Recurrence {
    if (mode === "daily") return { type: "daily" };
    if (mode === "interval") return { type: "interval", everyNDays: everyNDays || 1, anchorDate: TODAY };
    return { type: "weekly", weekdays };
  }

  const validLines = lines.every((line) => line.itemId);
  const confirmDisabled = !supplierId || !assignedUserId || !lines.length || !validLines || (mode === "weekly" && weekdays.length === 0);

  async function save() {
    if (confirmDisabled) return;
    setBusy(true);
    try {
      const payload = {
        supplierId,
        assignedUserId,
        escalationUserId: escalationUserId || null,
        reminderTimeOfDay: time,
        recurrence: buildRecurrence(),
        cutoffTime: cutoffTime || undefined,
        expectedDeliveryOffsetDays: deliveryOffset === "" ? undefined : Number(deliveryOffset),
        lines: lines.map((line, index) => ({
          itemId: line.itemId,
          defaultQuantity:
            line.defaultQuantity === "" || Number(line.defaultQuantity) <= 0
              ? undefined
              : Number(line.defaultQuantity),
          unit: line.unit.trim() || undefined,
          notes: line.notes.trim() || undefined,
          sortOrder: index,
        })),
      };
      if (rule) {
        await api(`/order-rules/${rule.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/order-rules", { method: "POST", body: JSON.stringify(payload) });
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={rule ? t.dialogEditTitle : t.dialogNewTitle}
      confirmLabel={rule ? t.saveChanges : t.createPlan}
      cancelLabel={c.cancel}
      width={760}
      confirmDisabled={confirmDisabled}
      busy={busy}
      onCancel={onClose}
      onConfirm={() => void save()}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t.supplier}>
            <Select value={supplierId} onChange={(e) => updateSupplier(e.target.value)}>
              <option value="" disabled>{t.selectSupplier}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.responsible}>
            <Select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
              <option value="" disabled>{t.selectPerson}</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.escalation} hint={t.optional}>
            <Select value={escalationUserId} onChange={(e) => setEscalationUserId(e.target.value)}>
              <option value="">{t.noEscalation}</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.deliveryOffset} hint={t.optional}>
            <Input
              type="number"
              min={0}
              value={deliveryOffset}
              onChange={(e) => setDeliveryOffset(e.target.value)}
              placeholder="1"
            />
          </Field>
        </div>

        <Field label={t.lines}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lines.map((line, index) => (
              <div
                key={index}
                style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) 140px 90px minmax(160px, 1fr) 34px", gap: 8, alignItems: "center" }}
              >
                <Select value={line.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value })}>
                  <option value="" disabled>{t.item}</option>
                  {supplierItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.defaultQuantity}
                  onChange={(e) => updateLine(index, { defaultQuantity: e.target.value })}
                  placeholder={t.quantity}
                />
                <Input value={line.unit} onChange={(e) => updateLine(index, { unit: e.target.value })} placeholder={t.unit} />
                <Input value={line.notes} onChange={(e) => updateLine(index, { notes: e.target.value })} placeholder={t.note} />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X size={15} />}
                  aria-label={t.removeLine}
                  disabled={lines.length === 1}
                  onClick={() => removeLine(index)}
                />
              </div>
            ))}
            <div>
              <Button variant="secondary" size="sm" icon={<Plus size={15} />} onClick={addLine} disabled={!supplierItems.length}>
                {t.addLine}
              </Button>
            </div>
          </div>
        </Field>

        <Field label={t.recurrence}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {([
              ["daily", t.modeDaily],
              ["weekly", t.modeWeekly],
              ["interval", t.modeInterval],
            ] as [Mode, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1px solid ${mode === key ? "var(--brand-300)" : "var(--border-default)"}`,
                  background: mode === key ? "var(--brand-50)" : "var(--surface-card)",
                  color: mode === key ? "var(--brand-700)" : "var(--text-body)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "weekly" ? (
            <div style={{ display: "flex", gap: 6 }}>
              {WEEKDAY_LABELS[lang].map((label, index) => {
                const day = index + 1;
                const on = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
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
                    {label}
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
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={t.reminderTime}>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label={t.cutoffTime} hint={t.optional}>
            <Input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
