"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Plus, Pencil, Send, Trash2, Repeat } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Field } from "@/components/ds/Field";
import { Select } from "@/components/ds/Select";
import { Badge } from "@/components/ds/Badge";
import { Table } from "@/components/ds/Table";
import { EmptyState } from "@/components/ds/EmptyState";
import { Dialog } from "@/components/ds/Dialog";
import { PageHead } from "@/components/ds/PageHead";
import { api } from "@/lib/api";
import type { Recurrence } from "@poruchka/shared";
import { useTr, useCommon, useLang, useApiError, type Lang } from "@/lib/i18n";

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
type WizardStep = "supplier" | "items" | "time";

const TODAY = new Date().toISOString().slice(0, 10);

/** Two letters, consistently — docs/BG-TERMINOLOGY.md style rule 7. "Чет"/"Пон"
 *  were the odd three-letter pair out. */
const WEEKDAY_LABELS: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
};

const WEEKDAY_FULL: Record<Lang, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"],
};

/** "Пн, Ср" reads as an unfinished list; Bulgarian wants the last item joined
 *  with "и". English gets the same treatment for free. */
function joinList(parts: string[], lang: Lang): string {
  if (parts.length < 2) return parts.join("");
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(", ")}${lang === "bg" ? " и " : " and "}${last}`;
}

function recurrenceLabel(r: Recurrence, lang: Lang): string {
  if (r.type === "daily") return lang === "bg" ? "Всеки ден" : "Every day";
  if (r.type === "interval") {
    if (r.everyNDays === 1) return lang === "bg" ? "Всеки ден" : "Every day";
    return lang === "bg" ? `На всеки ${r.everyNDays} дни` : `Every ${r.everyNDays} days`;
  }
  if (r.weekdays.length === 7) return lang === "bg" ? "Всеки ден" : "Every day";
  return (lang === "bg" ? "Всеки " : "Every ") + joinList(r.weekdays.map((d) => WEEKDAY_FULL[lang][d - 1]), lang);
}

function lineSummary(lines: OrderRuleLine[], empty: string): string {
  if (!lines.length) return empty;
  const names = lines.slice(0, 3).map((l) => l.item.name).join(", ");
  return lines.length > 3 ? `${names} +${lines.length - 3}` : names;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Math.min(23, Math.max(0, Number(rawHour) || 0));
  const minute = Math.round(Math.min(59, Math.max(0, Number(rawMinute) || 0)) / 5) * 5;
  return { hour, minute: minute === 60 ? 55 : minute };
}

function timeOfDay(hour: number, minute: number): string {
  return `${pad2((hour + 24) % 24)}:${pad2((minute + 60) % 60)}`;
}

function itemCountLabel(count: number, lang: Lang): string {
  if (lang === "bg") return `${count} ${count === 1 ? "артикул" : "артикула"}`;
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((day, index) => day === b[index]);
}

function recurrenceSentence(mode: Mode, weekdays: number[], everyNDays: number, time: string, lang: Lang): string {
  if (mode === "daily") return lang === "bg" ? `Всеки ден в ${time}` : `Every day at ${time}`;
  if (mode === "interval") {
    if (everyNDays <= 1) return lang === "bg" ? `Всеки ден в ${time}` : `Every day at ${time}`;
    return lang === "bg" ? `На всеки ${everyNDays} дни в ${time}` : `Every ${everyNDays} days at ${time}`;
  }

  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 7) return lang === "bg" ? `Всеки ден в ${time}` : `Every day at ${time}`;
  if (sameDays(sorted, [1, 2, 3, 4, 5])) {
    return lang === "bg" ? `Всеки делничен ден в ${time}` : `Every weekday at ${time}`;
  }
  const days = joinList(sorted.map((day) => WEEKDAY_LABELS[lang][day - 1]), lang);
  return lang === "bg" ? `Всеки ${days} в ${time}` : `Every ${days} at ${time}`;
}

const M = {
  en: {
    title: "Order plans",
    subtitle: "Supplier reminders with item checklists",
    newPlan: "New order plan",
    // The same words as the Dashboard's empty-state button: one control, one name.
    createPlan: "Create order plan",
    addBasicsFirst: "Add a supplier, an item, and a team member first",
    loadFailed: "Order plans could not be loaded. Please try again.",
    saveFailed: "The change could not be saved. Please try again.",
    loading: "Loading order plans…",
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
    testAria: "Send a test reminder to your Telegram",
    testSent: "Test reminder sent.",
    testFailedHint: "Test failed — is your Telegram linked?",
    deleteAria: "Archive order plan",
    archiveTitle: "Archive this order plan?",
    archiveDesc: "Future reminders stop, but existing order history stays visible.",
    archiveConfirm: "Archive plan",
    dialogEditTitle: "Edit order plan",
    dialogNewTitle: "New order plan",
    saveChanges: "Save changes",
    next: "Next",
    back: "Back",
    finish: "Done",
    itemsStep: "Items",
    timeStep: "Time",
    wizardSupplierTitle: "Choose a supplier",
    wizardSupplierHint: "Start with the supplier this reminder is for.",
    wizardItemsTitle: "Choose items from",
    wizardItemsHint: "Select the items this reminder should ask the team to check.",
    wizardTimeTitle: "Choose reminder time",
    wizardTimeHint: "Pick who receives it, how often it repeats, and the Telegram reminder time.",
    stepSupplier: "Step 1 — Supplier",
    stepItems: "Step 2 — Checklist from",
    selectedChecklist: "selected — this is the reminder checklist",
    noItemsForSupplier: "No items for this supplier yet.",
    previewEmpty: "Select items to build the checklist…",
    done: "Done",
    usual: "usual",
    dailyCaption: "Fires every single day.",
    quickTimes: "Quick times",
    increaseHour: "Increase hour",
    decreaseHour: "Decrease hour",
    increaseMinute: "Increase minute",
    decreaseMinute: "Decrease minute",
    supplier: "Supplier",
    responsible: "Responsible",
    backupPerson: "Backup person",
    optional: "Optional",
    selectPerson: "Select person…",
    noBackupPerson: "No backup person",
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
    // "план", never "график"/"разписание" — docs/BG-TERMINOLOGY.md.
    newPlan: "Нов план",
    createPlan: "Създай план",
    addBasicsFirst: "Първо добавете доставчик, артикул и човек от екипа",
    loadFailed: "Плановете не се заредиха. Опитайте отново.",
    saveFailed: "Промяната не бе запазена. Опитайте отново.",
    loading: "Зареждане на плановете…",
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
    testAria: "Изпрати тестово напомняне към вашия Telegram",
    testSent: "Тестовото напомняне е изпратено.",
    testFailedHint: "Тестът не успя — свързан ли е вашият Telegram?",
    deleteAria: "Архивирай плана",
    archiveTitle: "Да архивираме ли този план?",
    archiveDesc: "Бъдещите напомняния спират, но историята на поръчките остава видима.",
    archiveConfirm: "Архивирай",
    dialogEditTitle: "Редактиране на план",
    dialogNewTitle: "Нов план",
    saveChanges: "Запази",
    next: "Напред",
    back: "Назад",
    finish: "Готово",
    itemsStep: "Артикули",
    timeStep: "Час",
    wizardSupplierTitle: "Изберете доставчик",
    wizardSupplierHint: "Започнете с доставчика, за когото е напомнянето.",
    wizardItemsTitle: "Изберете артикули от",
    wizardItemsHint: "Изберете артикулите, които екипът да проверява преди поръчката.",
    wizardTimeTitle: "Изберете час",
    wizardTimeHint: "Изберете кой получава напомнянето, колко често се повтаря и в колко часа.",
    stepSupplier: "Стъпка 1 — Доставчик",
    stepItems: "Стъпка 2 — Списък от",
    selectedChecklist: "избрани — това е списъкът в напомнянето",
    noItemsForSupplier: "Няма артикули към този доставчик.",
    previewEmpty: "Изберете артикули, за да се изгради списъкът…",
    done: "Готово",
    usual: "обичайно",
    dailyCaption: "Ще подсеща всеки ден.",
    quickTimes: "Бързи часове",
    increaseHour: "Увеличи часа",
    decreaseHour: "Намали часа",
    increaseMinute: "Увеличи минутите",
    decreaseMinute: "Намали минутите",
    supplier: "Доставчик",
    responsible: "Отговорник",
    // The отговорник is the one already being nudged; the резервен човек is who
    // hears about it when there is no reaction. No escalation jargon on screen.
    backupPerson: "Резервен човек",
    optional: "По избор",
    selectPerson: "Изберете човек…",
    noBackupPerson: "Без резервен човек",
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

export default function OrdersPage() {
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
  const errText = useApiError();
  const [rules, setRules] = useState<OrderRule[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  // The cause is kept, not the finished sentence: the banner is translated at
  // render time, so flipping the language switch does not leave it in the old one.
  const [problem, setProblem] = useState<{ cause: unknown; kind: "load" | "save" } | null>(null);
  const [editing, setEditing] = useState<OrderRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<OrderRule | null>(null);
  const [testState, setTestState] = useState<{ id: string; ok: boolean } | null>(null);

  const refetch = useCallback(async () => {
    setRules(await api<OrderRule[]>("/order-rules"));
  }, []);

  // No translated string in the dep list: it used to depend on t.loadFailed, so
  // switching BG/EN refetched everything and closed nothing gracefully.
  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
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
    } catch (cause) {
      console.error(cause);
      setProblem({ cause, kind: "load" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const missingBasics = suppliers.length === 0 || items.length === 0 || team.length === 0;
  const problemText = problem ? errText(problem.cause, problem.kind === "load" ? t.loadFailed : t.saveFailed) : null;

  async function sendTestReminder(rule: OrderRule) {
    setTestState(null);
    try {
      await api(`/order-rules/${rule.id}/test-reminder`, { method: "POST" });
      setTestState({ id: rule.id, ok: true });
    } catch (cause) {
      console.error(cause);
      setTestState({ id: rule.id, ok: false });
    }
    window.setTimeout(() => setTestState(null), 2600);
  }

  async function toggleActive(rule: OrderRule) {
    setProblem(null);
    try {
      await api(`/order-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !rule.active }),
      });
      await refetch();
    } catch (cause) {
      console.error(cause);
      setProblem({ cause, kind: "save" });
    }
  }

  async function confirmArchive() {
    if (!archiving) return;
    setProblem(null);
    try {
      await api(`/order-rules/${archiving.id}`, { method: "DELETE" });
      setArchiving(null);
      await refetch();
    } catch (cause) {
      console.error(cause);
      setProblem({ cause, kind: "save" });
    }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <Button
              icon={<Plus size={16} aria-hidden="true" />}
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

      {/* Both regions stay mounted and only their contents change: a live region
          inserted together with its text is frequently never announced. */}
      <div role="alert" aria-atomic="true">
        {problemText ? (
          <div style={{ color: "var(--red-600)", fontSize: 14, marginBottom: 16 }}>{problemText}</div>
        ) : null}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {testState ? (
          <div
            style={{
              marginBottom: 16,
              fontSize: 13,
              color: testState.ok ? "var(--status-confirmed-fg)" : "var(--red-600)",
            }}
          >
            {testState.ok ? t.testSent : t.testFailedHint}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div role="status" style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {t.loading}
        </div>
      ) : rules.length === 0 ? (
        // After a failed load "no plans yet" would be a lie — the banner above
        // already says what happened.
        problemText ? null : (
          <EmptyState
            icon={<Repeat size={22} aria-hidden="true" />}
            title={t.emptyTitle}
            description={t.emptyDesc}
            action={
              <Button
                icon={<Plus size={16} aria-hidden="true" />}
                disabled={missingBasics}
                onClick={() => {
                  setEditing(null);
                  setCreating(true);
                }}
              >
                {t.createPlan}
              </Button>
            }
          />
        )
      ) : (
        <Table<OrderRule>
          columns={[
            { key: "supplier", label: t.colSupplier },
            { key: "items", label: t.colItems },
            { key: "recurrence", label: t.colRecurrence },
            { key: "time", label: t.colTime, width: 110 },
            { key: "assignee", label: t.colResponsible },
            { key: "active", label: t.colActive, align: "center", width: 90 },
            { key: "actions", label: "", align: "right", width: 122 },
          ]}
          rows={rules}
          rowKey={(r) => r.id}
          renderCell={(r, key) => {
            if (key === "supplier") return <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{r.supplier.name}</span>;
            if (key === "items")
              return (
                <span>
                  <span style={{ display: "block", color: "var(--text-body)" }}>{lineSummary(r.lines, t.none)}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{itemCountLabel(r.lines.length, lang)}</span>
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
                  aria-pressed={r.active}
                >
                  {r.active ? <Badge tone="confirmed" dot>{t.on}</Badge> : <Badge tone="neutral">{t.paused}</Badge>}
                </button>
              );
            return (
              <div style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={
                    testState?.id === r.id ? (
                      testState.ok ? (
                        <Check size={15} color="var(--status-confirmed-dot)" aria-hidden="true" />
                      ) : (
                        <Send size={15} color="var(--red-500)" aria-hidden="true" />
                      )
                    ) : (
                      <Send size={15} aria-hidden="true" />
                    )
                  }
                  aria-label={t.testAria}
                  title={testState?.id === r.id && !testState.ok ? t.testFailedHint : t.testAria}
                  onClick={() => void sendTestReminder(r)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={15} aria-hidden="true" />}
                  aria-label={t.edit}
                  onClick={() => {
                    setCreating(false);
                    setEditing(r);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} color="var(--red-500)" aria-hidden="true" />}
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
          description={`${archiving.supplier.name} — ${lineSummary(archiving.lines, t.none)}. ${t.archiveDesc}`}
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
  const errText = useApiError();
  const assigneeId = useId();
  const initialMode: Mode = rule ? rule.recurrence.type : "weekly";
  const steps: WizardStep[] = ["supplier", "items", "time"];
  const [step, setStep] = useState<WizardStep>("supplier");
  const [supplierId, setSupplierId] = useState(rule?.supplierId ?? suppliers[0]?.id ?? "");
  const [assignedUserId, setAssignedUserId] = useState(rule?.assignedUserId ?? team[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [weekdays, setWeekdays] = useState<number[]>(
    rule && rule.recurrence.type === "weekly" ? rule.recurrence.weekdays : [3],
  );
  const [everyNDays, setEveryNDays] = useState(
    rule && rule.recurrence.type === "interval" ? rule.recurrence.everyNDays : 14,
  );
  const [time, setTime] = useState(rule?.reminderTimeOfDay ?? "09:00");
  const [lines, setLines] = useState<DraftLine[]>(
    rule?.lines.map((l) => ({
      itemId: l.itemId,
      defaultQuantity: l.defaultQuantity != null ? String(l.defaultQuantity) : "",
      unit: l.unit ?? l.item.unit ?? "",
      notes: l.notes ?? "",
    })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierItems = useMemo(() => items.filter((i) => i.supplierId === supplierId), [items, supplierId]);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) ?? suppliers[0] ?? null;
  const lineByItemId = useMemo(() => new Map(lines.map((line) => [line.itemId, line])), [lines]);
  const selectedItems = supplierItems.filter((item) => lineByItemId.has(item.id));
  const previewLines = selectedItems.map((item) => {
    const line = lineByItemId.get(item.id);
    return {
      id: item.id,
      name: item.name,
      quantity: line?.defaultQuantity ?? "",
      unit: line?.unit || item.unit || "",
    };
  });
  const { hour, minute } = parseTimeOfDay(time);
  const quickTimes = ["07:00", "09:00", "14:00", "18:00"];
  const stepIndex = steps.indexOf(step);
  const isFinalStep = step === "time";

  function updateSupplier(nextSupplierId: string) {
    setSupplierId(nextSupplierId);
    setLines([]);
    setStep("items");
  }

  function toggleItem(item: Item) {
    setLines((current) => {
      if (current.some((line) => line.itemId === item.id)) {
        return current.filter((line) => line.itemId !== item.id);
      }
      return [...current, { itemId: item.id, defaultQuantity: "", unit: item.unit ?? "", notes: item.notes ?? "" }];
    });
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

  function setHour(nextHour: number) {
    setTime(timeOfDay(nextHour, minute));
  }

  function stepMinute(delta: number) {
    const total = hour * 60 + minute + delta;
    const normalized = ((total % 1440) + 1440) % 1440;
    setTime(timeOfDay(Math.floor(normalized / 60), normalized % 60));
  }

  const confirmDisabled = !supplierId || !assignedUserId || lines.length === 0 || (mode === "weekly" && weekdays.length === 0);
  const primaryDisabled =
    step === "supplier" ? !supplierId : step === "items" ? lines.length === 0 : confirmDisabled;

  function goBack() {
    setStep((current) => {
      const currentIndex = steps.indexOf(current);
      return steps[Math.max(0, currentIndex - 1)];
    });
  }

  function goNext() {
    setStep((current) => {
      const currentIndex = steps.indexOf(current);
      return steps[Math.min(steps.length - 1, currentIndex + 1)];
    });
  }

  function confirmPrimary() {
    if (!isFinalStep) {
      goNext();
      return;
    }
    void save();
  }

  async function save() {
    if (confirmDisabled) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        supplierId,
        assignedUserId,
        escalationUserId: rule?.escalationUserId ?? null,
        reminderTimeOfDay: time,
        recurrence: buildRecurrence(),
        cutoffTime: rule?.cutoffTime ?? undefined,
        expectedDeliveryOffsetDays: rule?.expectedDeliveryOffsetDays ?? undefined,
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
    } catch (cause) {
      // Without this the dialog swallowed the failure: it closed the busy state
      // and left the plan unsaved with nothing on screen to say so.
      console.error(cause);
      setError(errText(cause, t.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={rule ? t.dialogEditTitle : t.dialogNewTitle}
      confirmLabel={!isFinalStep ? t.next : rule ? t.saveChanges : t.createPlan}
      cancelLabel={c.cancel}
      secondaryLabel={stepIndex > 0 ? t.back : undefined}
      width={760}
      confirmDisabled={primaryDisabled}
      busy={busy}
      onCancel={onClose}
      onSecondary={goBack}
      onConfirm={confirmPrimary}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div role="alert" aria-atomic="true">
          {error ? (
            <div
              style={{
                padding: "11px 14px",
                border: "1px solid var(--status-escalated-bd)",
                borderRadius: "var(--radius-md)",
                background: "var(--status-escalated-bg)",
                color: "var(--status-escalated-fg)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <WizardProgress
          activeIndex={stepIndex}
          labels={[t.supplier, t.itemsStep, t.timeStep]}
        />

        {step === "supplier" ? (
          <section>
            <StepIntro title={t.wizardSupplierTitle} description={t.wizardSupplierHint} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {suppliers.map((supplier) => (
                <SupplierButton
                  key={supplier.id}
                  supplier={supplier}
                  itemCount={items.filter((item) => item.supplierId === supplier.id).length}
                  active={supplier.id === supplierId}
                  lang={lang}
                  onClick={() => updateSupplier(supplier.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {step === "items" ? (
          <section>
            <StepIntro
              title={`${t.wizardItemsTitle} ${selectedSupplier?.name ?? t.supplier}`}
              description={t.wizardItemsHint}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
              {supplierItems.length ? (
                supplierItems.map((item) => (
                  <ItemToggle
                    key={item.id}
                    item={item}
                    selectedLine={lineByItemId.get(item.id)}
                    onToggle={() => toggleItem(item)}
                  />
                ))
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.noItemsForSupplier}</div>
              )}
            </div>
            <div role="status" aria-live="polite" style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
              {lines.length} {t.selectedChecklist}
            </div>
          </section>
        ) : null}

        {step === "time" ? (
          <section>
            <StepIntro title={t.wizardTimeTitle} description={t.wizardTimeHint} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Field renders its <label> as a sibling, not a wrapper, so the
                    select needs an explicit id or it has no accessible name. */}
                <Field label={t.responsible} htmlFor={assigneeId}>
                  <Select id={assigneeId} value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
                    <option value="" disabled>{t.selectPerson}</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </Select>
                </Field>

                <div>
                  <Eyebrow>{t.recurrence}</Eyebrow>
                  <SegmentedModePicker
                    mode={mode}
                    groupLabel={t.recurrence}
                    labels={{ daily: t.modeDaily, weekly: t.modeWeekly, interval: t.modeInterval }}
                    onChange={setMode}
                  />

                  {mode === "weekly" ? (
                    <div role="group" aria-label={t.recurrence} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                      {WEEKDAY_LABELS[lang].map((label, index) => {
                        const day = index + 1;
                        const on = weekdays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            aria-pressed={on}
                            aria-label={WEEKDAY_FULL[lang][index]}
                            style={{
                              appearance: "none",
                              WebkitAppearance: "none",
                              minWidth: 46,
                              height: 38,
                              padding: "0 12px",
                              borderRadius: "var(--radius-md)",
                              border: `1px solid ${on ? "var(--brand-500)" : "var(--border-default)"}`,
                              background: on ? "var(--brand-50)" : "var(--surface-card)",
                              color: on ? "var(--brand-700)" : "var(--text-muted)",
                              fontFamily: "var(--font-sans)",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all var(--dur-fast) var(--ease-out)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {mode === "interval" ? (
                    <IntervalStepper
                      everyNDays={everyNDays}
                      every={t.every}
                      days={t.days}
                      onChange={(next) => setEveryNDays(Math.min(60, Math.max(1, next)))}
                    />
                  ) : null}

                  {mode === "daily" ? (
                    <div style={{ marginTop: 14, fontSize: 13, color: "var(--text-muted)" }}>{t.dailyCaption}</div>
                  ) : null}
                </div>

                <div>
                  <Eyebrow>{t.reminderTime}</Eyebrow>
                  <TimeStepper
                    hour={hour}
                    minute={minute}
                    labels={{
                      increaseHour: t.increaseHour,
                      decreaseHour: t.decreaseHour,
                      increaseMinute: t.increaseMinute,
                      decreaseMinute: t.decreaseMinute,
                    }}
                    onHourChange={setHour}
                    onMinuteStep={stepMinute}
                  />
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{t.quickTimes}</div>
                    <div role="group" aria-label={t.quickTimes} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {quickTimes.map((quickTime) => (
                        <button
                          key={quickTime}
                          type="button"
                          onClick={() => setTime(quickTime)}
                          aria-pressed={time === quickTime}
                          style={{
                            appearance: "none",
                            WebkitAppearance: "none",
                            borderRadius: "var(--radius-pill)",
                            border: `1px solid ${time === quickTime ? "var(--brand-200)" : "var(--border-default)"}`,
                            background: time === quickTime ? "var(--brand-50)" : "var(--surface-card)",
                            color: time === quickTime ? "var(--brand-700)" : "var(--text-muted)",
                            padding: "7px 12px",
                            fontFamily: "var(--font-mono)",
                            fontSize: 12.5,
                            cursor: "pointer",
                          }}
                        >
                          {quickTime}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 12px",
                    background: "var(--brand-50)",
                    border: "1px solid var(--brand-100)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--brand-700)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-500)", flex: "none" }} />
                  {recurrenceSentence(mode, weekdays, everyNDays, time, lang)}
                </div>
              </div>

              <ReminderPreview
                supplierName={selectedSupplier?.name ?? t.supplier}
                time={time}
                lines={previewLines}
                labels={{ empty: t.previewEmpty, done: t.done, usual: t.usual }}
                lang={lang}
              />
            </div>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 10,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </div>
  );
}

function StepIntro({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-strong)" }}>
        {title}
      </div>
      <div style={{ marginTop: 5, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.45 }}>
        {description}
      </div>
    </div>
  );
}

function WizardProgress({ activeIndex, labels }: { activeIndex: number; labels: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`, gap: 8 }}>
      {labels.map((label, index) => {
        const active = index === activeIndex;
        const complete = index < activeIndex;
        return (
          <div
            key={label}
            aria-current={active ? "step" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              padding: "9px 10px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${active || complete ? "var(--brand-200)" : "var(--border-subtle)"}`,
              background: active ? "var(--brand-50)" : complete ? "color-mix(in srgb, var(--brand-50) 42%, var(--surface-card))" : "var(--surface-sunken)",
              color: active || complete ? "var(--brand-700)" : "var(--text-muted)",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "var(--radius-pill)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
                background: active || complete ? "var(--brand-500)" : "var(--surface-card)",
                color: active || complete ? "#fff" : "var(--text-muted)",
                border: `1px solid ${active || complete ? "var(--brand-500)" : "var(--border-default)"}`,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {complete ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : index + 1}
            </span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 700 }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SupplierButton({
  supplier,
  itemCount,
  active,
  lang,
  onClick,
}: {
  supplier: Supplier;
  itemCount: number;
  active: boolean;
  lang: Lang;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        minWidth: 132,
        padding: "12px 16px",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${active ? "var(--brand-500)" : "var(--border-default)"}`,
        background: active ? "var(--brand-50)" : "var(--surface-card)",
        color: active ? "var(--brand-800)" : "var(--text-strong)",
        boxShadow: active ? "inset 0 0 0 1px var(--brand-500)" : "var(--shadow-xs)",
        textAlign: "left",
        cursor: "pointer",
        transition: "all var(--dur-fast) var(--ease-out)",
      }}
    >
      <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{supplier.name}</span>
      <span style={{ display: "block", marginTop: 3, fontSize: 12, opacity: 0.65 }}>{itemCountLabel(itemCount, lang)}</span>
    </button>
  );
}

function ItemToggle({
  item,
  selectedLine,
  onToggle,
}: {
  item: Item;
  selectedLine?: DraftLine;
  onToggle: () => void;
}) {
  const selected = Boolean(selectedLine);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: 58,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${selected ? "var(--brand-300)" : "var(--border-default)"}`,
        background: selected ? "var(--brand-50)" : "var(--surface-card)",
        boxShadow: "var(--shadow-xs)",
        color: selected ? "var(--brand-800)" : "var(--text-body)",
        textAlign: "left",
        cursor: "pointer",
        transition: "all var(--dur-fast) var(--ease-out)",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `1px solid ${selected ? "var(--brand-500)" : "var(--border-default)"}`,
          background: selected ? "var(--brand-500)" : "var(--surface-card)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Check size={13} strokeWidth={3.5} color="#fff" aria-hidden="true" style={{ opacity: selected ? 1 : 0, transition: "opacity var(--dur-fast) var(--ease-out)" }} />
      </span>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
        {item.notes ? <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.notes}</span> : null}
      </span>
      {item.unit ? (
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", flex: "none" }}>{item.unit}</span>
      ) : null}
    </button>
  );
}

function ReminderPreview({
  supplierName,
  time,
  lines,
  labels,
  lang,
}: {
  supplierName: string;
  time: string;
  lines: { id: string; name: string; quantity: string; unit: string }[];
  labels: { empty: string; done: string; usual: string };
  lang: Lang;
}) {
  return (
    <div style={{ flex: "none", width: 340, maxWidth: "100%", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 4 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "var(--radius-pill)",
            flex: "none",
            background: "var(--brand-500)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={14} strokeWidth={3} color="#fff" aria-hidden="true" />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-strong)" }}>Poruchka bot</span>
        {/* --text-faint clears only the 3:1 non-text floor: anything a person has
            to read uses --text-muted (app/ds/colors.css). */}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{time}</span>
      </div>

      <div
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "4px 16px 16px 16px",
          boxShadow: "var(--shadow-md)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 16, lineHeight: 1.35, color: "var(--text-strong)" }}>
          <span aria-hidden>🛒</span>{" "}
          {lang === "bg" ? (
            <>
              Проверете поръчката към <strong style={{ fontWeight: 700 }}>{supplierName}</strong> днес.
            </>
          ) : (
            <>
              Check the order from <strong style={{ fontWeight: 700 }}>{supplierName}</strong> today.
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {lines.length ? (
            lines.map((line) => {
              const quantity = line.quantity && Number(line.quantity) > 0 ? `${line.quantity}${line.unit ? ` ${line.unit}` : ""}` : "";
              return (
                <div key={line.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: "1.5px solid var(--border-default)", flex: "none" }} />
                  <span style={{ fontSize: 14, color: "var(--text-body)" }}>{line.name}</span>
                  {quantity ? (
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                      {labels.usual}: {quantity}
                    </span>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{labels.empty}</div>
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "var(--accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <Check size={16} strokeWidth={2.5} aria-hidden="true" />
          {labels.done}
        </div>
      </div>
    </div>
  );
}

function SegmentedModePicker({
  mode,
  groupLabel,
  labels,
  onChange,
}: {
  mode: Mode;
  groupLabel: string;
  labels: { daily: string; weekly: string; interval: string };
  onChange: (mode: Mode) => void;
}) {
  const options: [Mode, string][] = [
    ["daily", labels.daily],
    ["weekly", labels.weekly],
    ["interval", labels.interval],
  ];
  return (
    <div
      role="group"
      aria-label={groupLabel}
      style={{
        display: "flex",
        gap: 5,
        background: "var(--surface-sunken)",
        padding: 4,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {options.map(([key, label]) => {
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              flex: 1,
              padding: "9px 0",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: active ? "var(--surface-card)" : "transparent",
              color: active ? "var(--brand-700)" : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function IntervalStepper({
  everyNDays,
  every,
  days,
  onChange,
}: {
  everyNDays: number;
  every: string;
  days: string;
  onChange: (next: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
      <span style={{ fontSize: 14, color: "var(--text-body)" }}>{every}</span>
      <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface-card)" }}>
        <button type="button" aria-label={`${every} −1`} onClick={() => onChange(everyNDays - 1)} style={smallStepperButtonStyle}>-</button>
        <span style={{ width: 46, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, color: "var(--text-strong)" }}>{everyNDays}</span>
        <button type="button" aria-label={`${every} +1`} onClick={() => onChange(everyNDays + 1)} style={smallStepperButtonStyle}>+</button>
      </div>
      <span style={{ fontSize: 14, color: "var(--text-body)" }}>{days}</span>
    </div>
  );
}

const smallStepperButtonStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  width: 34,
  height: 34,
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  fontFamily: "var(--font-sans)",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
};

function TimeStepper({
  hour,
  minute,
  labels,
  onHourChange,
  onMinuteStep,
}: {
  hour: number;
  minute: number;
  labels: { increaseHour: string; decreaseHour: string; increaseMinute: string; decreaseMinute: string };
  onHourChange: (hour: number) => void;
  onMinuteStep: (delta: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <TimeColumn
        value={pad2(hour)}
        onUp={() => onHourChange(hour + 1)}
        onDown={() => onHourChange(hour - 1)}
        upLabel={labels.increaseHour}
        downLabel={labels.decreaseHour}
      />
      <span aria-hidden="true" style={{ fontFamily: "var(--font-mono)", fontSize: 38, fontWeight: 700, color: "var(--text-muted)", paddingTop: 28 }}>:</span>
      <TimeColumn
        value={pad2(minute)}
        onUp={() => onMinuteStep(5)}
        onDown={() => onMinuteStep(-5)}
        upLabel={labels.increaseMinute}
        downLabel={labels.decreaseMinute}
      />
    </div>
  );
}

function TimeColumn({
  value,
  onUp,
  onDown,
  upLabel,
  downLabel,
}: {
  value: string;
  onUp: () => void;
  onDown: () => void;
  upLabel: string;
  downLabel: string;
}) {
  return (
    <div style={{ width: 74, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <button type="button" aria-label={upLabel} onClick={onUp} style={timeStepperButtonStyle}>
        <ChevronUp size={17} aria-hidden="true" />
      </button>
      <div style={{ width: 70, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 44, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1 }}>
        {value}
      </div>
      <button type="button" aria-label={downLabel} onClick={onDown} style={timeStepperButtonStyle}>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

const timeStepperButtonStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  width: 52,
  height: 32,
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-card)",
  color: "var(--text-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
