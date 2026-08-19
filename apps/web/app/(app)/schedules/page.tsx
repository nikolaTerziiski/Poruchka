"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Archive, ChevronRight, Pause, Pencil, Play, Plus, Repeat } from "lucide-react";
import type { CSSProperties } from "react";
import type { Recurrence } from "@poruchka/shared";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Checkbox } from "@/components/ds/Checkbox";
import { Dialog } from "@/components/ds/Dialog";
import { EmptyState } from "@/components/ds/EmptyState";
import { Field } from "@/components/ds/Field";
import { Input } from "@/components/ds/Input";
import { PageHead } from "@/components/ds/PageHead";
import { Select } from "@/components/ds/Select";
import { Table } from "@/components/ds/Table";
import { SetupChecklist } from "@/components/SetupChecklist";
import { api } from "@/lib/api";
import { apiErrorText, useCommon, useLang, useTr, type Lang } from "@/lib/i18n";

type Quantity = string | number | null;
type Mode = "daily" | "weekly" | "interval";

interface Supplier {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  supplierId: string;
  unit: string | null;
  supplier: Supplier;
}

interface TeamMember {
  id: string;
  name: string;
  /** null = this person has never connected Telegram, so no reminder can reach
   *  them. GET /team and GET /order-rules both return it (team.controller.ts
   *  MEMBER_SELECT / order-rules.controller.ts include). */
  chatUserId: string | null;
}

interface OrderRuleLine {
  id: string;
  itemId: string;
  defaultQuantity: Quantity;
  unit: string | null;
  notes: string | null;
  item: Item;
}

interface OrderRule {
  id: string;
  supplierId: string;
  assignedUserId: string;
  escalationUserId: string | null;
  reminderTimeOfDay: string;
  cutoffTime: string | null;
  expectedDeliveryOffsetDays: number | null;
  recurrence: Recurrence;
  active: boolean;
  supplier: Supplier;
  assignedUser: TeamMember;
  escalationUser: TeamMember | null;
  lines: OrderRuleLine[];
}

const M = {
  en: {
    title: "Order plans",
    subtitle: "Group recurring items into the supplier order your team actually places",
    newPlan: "New order plan",
    loading: "Loading order plans…",
    loadFailed: "Could not load order plans.",
    emptyTitle: "No recurring orders yet",
    emptyDesc: "Create an order plan for Metro with all of its items, quantities, deadline, and responsible person.",
    setupTitle: "A few quick steps first",
    setupDesc: "Once you have a supplier, an item and a team member, you can create your first order plan.",
    supplier: "Supplier",
    items: "Items",
    recurrence: "How often",
    timing: "Timing",
    responsible: "Responsible",
    status: "Status",
    active: "Active",
    paused: "Paused",
    pauseAction: "Pause this plan",
    activateAction: "Activate this plan",
    noticePaused: "Plan paused — no reminders will be sent.",
    noticeResumed: "Plan resumed — reminders will continue.",
    noticeArchived: "Order plan archived.",
    statusFailed: "Could not change the plan's status.",
    archiveFailed: "Could not archive the order plan.",
    notLinked: "Telegram not connected",
    assigneeUnlinked: "This person has no Telegram connected and won't receive the reminders. Connect them on the Team page.",
    nobodyReachable: "Neither the responsible person nor the backup person has Telegram connected — this order will not reach anyone.",
    reminderAt: (time: string) => `Reminder ${time}`,
    cutoffAt: (time: string) => `Cutoff ${time}`,
    deliveryIn: (days: number) => `Delivery +${days}d`,
    noCutoff: "no cutoff",
    edit: "Edit order plan",
    archive: "Archive order plan",
    archiveTitle: "Archive this order plan?",
    archiveDesc: "Future orders will stop. Existing order history stays intact.",
    archiveConfirm: "Archive plan",
    archiving: "Archiving…",
    createTitle: "New order plan",
    editTitle: "Edit order plan",
    save: "Save plan",
    chooseSupplier: "Choose a supplier…",
    choosePerson: "Choose a person…",
    none: "No backup person",
    assignee: "Responsible person",
    escalation: "Backup person",
    escalationHint: "Optional. Gets a message if the order isn't placed in time.",
    moreSettings: "More settings (optional)",
    reminderTime: "Reminder time",
    cutoffTime: "Supplier cutoff",
    cutoffHint: "How late the supplier accepts orders.",
    deliveryDays: "Days until delivery arrives",
    deliveryHint: "For example 1 = the delivery arrives the next day.",
    selectItems: "Items and usual quantities",
    noSupplierItems: "This supplier has no items yet.",
    quantity: "Usual quantity",
    daily: "Daily",
    weekly: "Weekly",
    interval: "Every N days",
    weekdayGroup: "Days of the week",
    every: "Every",
    days: "days",
    intervalAria: "How many days between orders",
    selectOneItem: "Select at least one item.",
    saveFailed: "Could not save the order plan.",
  },
  bg: {
    title: "Планове за поръчки",
    subtitle: "Групирайте артикулите в реалната поръчка към всеки доставчик",
    newPlan: "Нов план за поръчка",
    loading: "Зареждане на плановете…",
    loadFailed: "Плановете не можаха да бъдат заредени.",
    emptyTitle: "Все още няма повтарящи се поръчки",
    emptyDesc: "Създайте план за поръчка към Метро с всички артикули, количества, краен час и отговорник.",
    setupTitle: "Първо няколко бързи стъпки",
    setupDesc: "Щом добавите доставчик, артикул и човек от екипа, можете да създадете първия план за поръчка.",
    supplier: "Доставчик",
    items: "Артикули",
    recurrence: "Колко често",
    timing: "Време",
    responsible: "Отговорник",
    status: "Статус",
    active: "Активен",
    paused: "На пауза",
    pauseAction: "Спри плана временно",
    activateAction: "Пусни плана отново",
    noticePaused: "Планът е на пауза — напомняния няма да се изпращат.",
    noticeResumed: "Планът е активен отново — напомнянията продължават.",
    noticeArchived: "Планът е архивиран.",
    statusFailed: "Статусът на плана не можа да бъде променен.",
    archiveFailed: "Планът не можа да бъде архивиран.",
    notLinked: "Telegram не е свързан",
    // No "го": style rule 2 forbids assuming the person's gender.
    assigneeUnlinked: "Този човек няма свързан Telegram и няма да получава напомнянията. Свържете Telegram от страницата „Екип“.",
    nobodyReachable: "Нито отговорникът, нито резервният човек имат свързан Telegram — тази поръчка няма да стигне до никого.",
    reminderAt: (time: string) => `Напомняне ${time}`,
    cutoffAt: (time: string) => `Краен час ${time}`,
    deliveryIn: (days: number) => `Доставка +${days} ${days === 1 ? "ден" : "дни"}`,
    noCutoff: "без краен час",
    edit: "Редактирай плана",
    archive: "Архивирай плана",
    archiveTitle: "Да архивираме ли този план?",
    archiveDesc: "Бъдещите поръчки ще спрат, но историята ще се запази.",
    archiveConfirm: "Архивирай",
    archiving: "Архивиране…",
    createTitle: "Нов план за поръчка",
    editTitle: "Редактиране на план",
    save: "Запази плана",
    chooseSupplier: "Изберете доставчик…",
    choosePerson: "Изберете човек…",
    none: "Без резервен човек",
    assignee: "Отговорник",
    escalation: "Резервен човек",
    escalationHint: "По избор. Получава съобщение, ако поръчката не бъде направена навреме.",
    moreSettings: "Още настройки (по избор)",
    reminderTime: "Час за напомняне",
    cutoffTime: "Краен час на доставчика",
    cutoffHint: "Докога доставчикът приема поръчки.",
    deliveryDays: "След колко дни пристига доставката",
    deliveryHint: "Например 1 = доставката идва на следващия ден.",
    selectItems: "Артикули и обичайни количества",
    noSupplierItems: "Този доставчик все още няма артикули.",
    quantity: "Обичайно количество",
    daily: "Всеки ден",
    weekly: "Седмично",
    interval: "През определен брой дни",
    weekdayGroup: "Дни от седмицата",
    every: "На всеки",
    days: "дни",
    intervalAria: "На колко дни да се поръчва",
    selectOneItem: "Изберете поне един артикул.",
    saveFailed: "Планът не можа да бъде запазен.",
  },
} as const;

// Two letters throughout, per docs/BG-TERMINOLOGY.md style rule 7 ("Чет"/"Пон"
// are not standard). Index 0 = Monday, matching Recurrence.weekdays (1-7).
const WEEKDAYS: Record<Lang, readonly string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  bg: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
};

const FULL_WEEKDAYS: Record<Lang, readonly string[]> = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  bg: ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"],
};

/** "Всеки понеделник" but "Всяка сряда" — the article follows the day's gender. */
const WEEKDAY_ARTICLE_BG = ["Всеки", "Всеки", "Всяка", "Всеки", "Всеки", "Всяка", "Всяка"];

function localToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recurrenceLabel(recurrence: Recurrence, lang: Lang): string {
  if (recurrence.type === "daily") return lang === "bg" ? "Всеки ден" : "Every day";
  if (recurrence.type === "interval") {
    // Style rule 8: the plural has to agree with the number — never "1 дни".
    const n = recurrence.everyNDays;
    return lang === "bg" ? `На всеки ${n} ${n === 1 ? "ден" : "дни"}` : `Every ${n} ${n === 1 ? "day" : "days"}`;
  }
  // A single weekday reads as "Всяка сряда", never "Всяка седмица: Ср".
  if (recurrence.weekdays.length === 1) {
    const index = recurrence.weekdays[0] - 1;
    if (index >= 0 && index < 7) {
      return lang === "bg"
        ? `${WEEKDAY_ARTICLE_BG[index]} ${FULL_WEEKDAYS.bg[index]}`
        : `Every ${FULL_WEEKDAYS.en[index]}`;
    }
  }
  const days = recurrence.weekdays.map((day) => WEEKDAYS[lang][day - 1]).join(", ");
  return lang === "bg" ? `Всяка седмица: ${days}` : `Every ${days}`;
}

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
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<OrderRule | null>(null);
  const [archiving, setArchiving] = useState<OrderRule | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

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
    } catch (cause) {
      setError(apiErrorText(cause, lang, t.loadFailed));
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const canCreate = suppliers.length > 0 && items.length > 0 && team.length > 0;

  const toggleActive = async (rule: OrderRule) => {
    if (statusBusyId) return;
    setStatusBusyId(rule.id);
    setError(null);
    setNotice(null);
    try {
      await api(`/order-rules/${rule.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ active: !rule.active }),
      });
      await load();
      setNotice(rule.active ? t.noticePaused : t.noticeResumed);
    } catch (cause) {
      setError(apiErrorText(cause, lang, t.statusFailed));
    } finally {
      setStatusBusyId(null);
    }
  };

  const archive = async () => {
    if (!archiving || archiveBusy) return;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await api(`/order-rules/${archiving.id}`, { method: "DELETE" });
      setArchiving(null);
      await load();
      setNotice(t.noticeArchived);
    } catch (cause) {
      // The dialog stays open on failure and the page-level banner would render
      // behind the dimmed backdrop, so this error belongs inside the dialog.
      setArchiveError(apiErrorText(cause, lang, t.archiveFailed));
    } finally {
      setArchiveBusy(false);
    }
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={t.subtitle}
        action={
          canCreate ? (
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              {t.newPlan}
            </Button>
          ) : null
        }
      />

      {error ? <ErrorBanner message={error} /> : notice ? <NoticeBanner message={notice} /> : null}

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>{t.loading}</div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Repeat size={22} />}
          title={canCreate ? t.emptyTitle : t.setupTitle}
          description={canCreate ? t.emptyDesc : t.setupDesc}
          action={
            canCreate ? (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                {t.newPlan}
              </Button>
            ) : (
              <SetupChecklist
                suppliers={suppliers.length}
                items={items.length}
                team={team.length}
                onCreatePlan={() => setCreating(true)}
              />
            )
          }
        />
      ) : (
        <Table<OrderRule>
          label={t.title}
          columns={[
            { key: "supplier", label: t.supplier },
            { key: "items", label: t.items },
            { key: "recurrence", label: t.recurrence },
            { key: "timing", label: t.timing },
            { key: "responsible", label: t.responsible },
            { key: "status", label: t.status, align: "center" },
            { key: "actions", label: "", align: "right", stickyRight: true },
          ]}
          rows={rules}
          rowKey={(rule) => rule.id}
          renderCell={(rule, key) => {
            if (key === "supplier") return <strong style={{ color: "var(--text-strong)" }}>{rule.supplier.name}</strong>;
            if (key === "items")
              return (
                <div style={{ maxWidth: 260 }}>
                  {rule.lines.map((line) => (
                    <div key={line.id} style={{ fontSize: 13, lineHeight: 1.55 }}>
                      {line.item.name}
                      {line.defaultQuantity !== null ? (
                        <span style={{ color: "var(--text-muted)" }}> · {String(line.defaultQuantity)} {line.unit ?? line.item.unit ?? ""}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            if (key === "recurrence") return <Badge tone="accent">{recurrenceLabel(rule.recurrence, lang)}</Badge>;
            if (key === "timing")
              return (
                <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                  <div>{t.reminderAt(rule.reminderTimeOfDay)}</div>
                  {rule.cutoffTime ? <div style={{ color: "var(--text-muted)" }}>{t.cutoffAt(rule.cutoffTime)}</div> : null}
                  {rule.expectedDeliveryOffsetDays !== null ? (
                    <div style={{ color: "var(--text-muted)" }}>{t.deliveryIn(rule.expectedDeliveryOffsetDays)}</div>
                  ) : null}
                </div>
              );
            if (key === "responsible")
              return (
                <div>
                  <div>{rule.assignedUser.name}</div>
                  {/* A plan assigned to someone who never linked Telegram is
                      broken; the owner should see that by scanning the table. */}
                  {rule.assignedUser.chatUserId ? null : (
                    <div style={{ fontSize: 12, color: "var(--status-escalated-fg)" }}>{t.notLinked}</div>
                  )}
                  {rule.escalationUser ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      → {rule.escalationUser.name}
                      {rule.escalationUser.chatUserId ? null : (
                        <span style={{ color: "var(--status-escalated-fg)" }}> · {t.notLinked}</span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            // Read-only status. Pause/resume is a real button in the action
            // group below — a status pill is not an affordance for anything.
            if (key === "status")
              return (
                <Badge tone={rule.active ? "confirmed" : "neutral"} dot={rule.active}>
                  {rule.active ? t.active : t.paused}
                </Badge>
              );
            return (
              <div style={{ display: "inline-flex", gap: 4 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={rule.active ? <Pause size={15} /> : <Play size={15} />}
                  aria-label={rule.active ? t.pauseAction : t.activateAction}
                  title={rule.active ? t.pauseAction : t.activateAction}
                  disabled={statusBusyId === rule.id}
                  onClick={() => void toggleActive(rule)}
                />
                <Button variant="ghost" size="sm" iconOnly icon={<Pencil size={15} />} aria-label={t.edit} title={t.edit} onClick={() => setEditing(rule)} />
                <Button variant="ghost" size="sm" iconOnly icon={<Archive size={15} />} aria-label={t.archive} title={t.archive} onClick={() => setArchiving(rule)} />
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
            setCreating(false);
            setEditing(null);
            await load();
          }}
        />
      ) : null}

      {archiving ? (
        <Dialog
          tone="danger"
          title={t.archiveTitle}
          description={`${archiving.supplier.name}. ${t.archiveDesc}`}
          confirmLabel={t.archiveConfirm}
          busyLabel={t.archiving}
          cancelLabel={c.cancel}
          busy={archiveBusy}
          onCancel={() => {
            setArchiving(null);
            setArchiveError(null);
          }}
          onConfirm={() => void archive()}
        >
          {archiveError ? <ErrorBanner message={archiveError} style={{ marginBottom: 0 }} /> : null}
        </Dialog>
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
  onSaved: () => Promise<void>;
}) {
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
  const supplierFieldId = useId();
  const assigneeFieldId = useId();
  const escalationFieldId = useId();
  const recurrenceLabelId = useId();
  const timeFieldId = useId();
  const cutoffFieldId = useId();
  const deliveryFieldId = useId();
  const itemsLabelId = useId();
  const moreSettingsId = useId();
  const [supplierId, setSupplierId] = useState(rule?.supplierId ?? "");
  // A solo owner is the only possible assignee — do not make them pick.
  const [assignedUserId, setAssignedUserId] = useState(rule?.assignedUserId ?? (team.length === 1 ? team[0].id : ""));
  const [escalationUserId, setEscalationUserId] = useState(rule?.escalationUserId ?? "");
  const [time, setTime] = useState(rule?.reminderTimeOfDay ?? "09:00");
  const [cutoff, setCutoff] = useState(rule?.cutoffTime ?? "");
  const [deliveryDays, setDeliveryDays] = useState(rule?.expectedDeliveryOffsetDays?.toString() ?? "");
  const [mode, setMode] = useState<Mode>(rule?.recurrence.type ?? "weekly");
  const [weekdays, setWeekdays] = useState<number[]>(
    rule?.recurrence.type === "weekly" ? rule.recurrence.weekdays : [3],
  );
  const [everyNDays, setEveryNDays] = useState(
    rule?.recurrence.type === "interval" ? rule.recurrence.everyNDays.toString() : "14",
  );
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(rule?.lines.map((line) => [line.itemId, line.defaultQuantity === null ? "" : String(line.defaultQuantity)]) ?? []),
  );
  // Four low-information settings stay folded away on day one, but an existing
  // plan that uses any of them opens with them in view.
  const [moreOpen, setMoreOpen] = useState(
    Boolean(rule && (rule.cutoffTime || rule.expectedDeliveryOffsetDays !== null || rule.escalationUserId)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierItems = useMemo(() => items.filter((item) => item.supplierId === supplierId), [items, supplierId]);
  const selectedIds = Object.keys(selected);
  const confirmDisabled = !supplierId || !assignedUserId || selectedIds.length === 0 || (mode === "weekly" && weekdays.length === 0);

  const assignee = team.find((member) => member.id === assignedUserId) ?? null;
  const backup = escalationUserId ? team.find((member) => member.id === escalationUserId) ?? null : null;
  const assigneeUnlinked = Boolean(assignee) && !assignee?.chatUserId;
  // No backup chosen is as unreachable as an unlinked one.
  const backupUnreachable = !backup || !backup.chatUserId;
  const reachWarning = !assigneeUnlinked ? null : backupUnreachable ? t.nobodyReachable : t.assigneeUnlinked;
  const reachWarningColor = reachWarning === t.nobodyReachable ? "var(--status-escalated-fg)" : "var(--status-pending-fg)";

  const memberOption = (member: TeamMember) => (member.chatUserId ? member.name : `${member.name} — ${t.notLinked}`);

  const summary = [t.reminderAt(time), cutoff ? t.cutoffAt(cutoff) : t.noCutoff, backup?.name]
    .filter(Boolean)
    .join(" · ");

  const changeSupplier = (nextSupplierId: string) => {
    if (nextSupplierId !== supplierId) setSelected({});
    setSupplierId(nextSupplierId);
  };

  const toggleItem = (itemId: string, checked: boolean) => {
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[itemId] = "";
      else delete next[itemId];
      return next;
    });
  };

  const buildRecurrence = (): Recurrence => {
    if (mode === "daily") return { type: "daily" };
    if (mode === "interval") return { type: "interval", everyNDays: Math.max(1, Number(everyNDays) || 1), anchorDate: localToday() };
    return { type: "weekly", weekdays };
  };

  const save = async () => {
    if (confirmDisabled) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        supplierId,
        assignedUserId,
        escalationUserId: escalationUserId || null,
        reminderTimeOfDay: time,
        recurrence: buildRecurrence(),
        cutoffTime: cutoff || null,
        expectedDeliveryOffsetDays: deliveryDays === "" ? null : Number(deliveryDays),
        active: rule?.active ?? true,
        lines: selectedIds.map((itemId, index) => {
          const item = items.find((candidate) => candidate.id === itemId)!;
          return {
            itemId,
            defaultQuantity: selected[itemId] === "" ? null : Number(selected[itemId]),
            unit: item.unit,
            sortOrder: index,
          };
        }),
      };
      await api(rule ? `/order-rules/${rule.id}` : "/order-rules", {
        method: rule ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      await onSaved();
    } catch (cause) {
      setError(apiErrorText(cause, lang, t.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={rule ? t.editTitle : t.createTitle}
      confirmLabel={t.save}
      cancelLabel={c.cancel}
      width={720}
      busy={busy}
      confirmDisabled={confirmDisabled}
      onCancel={onClose}
      onConfirm={() => void save()}
    >
      <style>{`
        .plan-item-row { display:grid; grid-template-columns:minmax(0,1fr) 160px; gap:14px; align-items:center; padding:11px 14px; }
        @media (max-width: 560px) {
          .plan-item-row { grid-template-columns:1fr; gap:8px; align-items:start; }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error ? <ErrorBanner message={error} /> : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Field label={t.supplier} htmlFor={supplierFieldId} required>
            <Select id={supplierFieldId} value={supplierId} onChange={(event) => changeSupplier(event.target.value)}>
              <option value="">{t.chooseSupplier}</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
          </Field>
          <Field
            label={t.assignee}
            htmlFor={assigneeFieldId}
            required
            hint={reachWarning ? <span style={{ color: reachWarningColor }}>{reachWarning}</span> : undefined}
          >
            <Select id={assigneeFieldId} value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
              <option value="">{t.choosePerson}</option>
              {team.map((member) => <option key={member.id} value={member.id}>{memberOption(member)}</option>)}
            </Select>
          </Field>
        </div>

        <Field label={<span id={recurrenceLabelId}>{t.recurrence}</span>} required>
          {/* The mode and weekday pickers are buttons, not one control, so the
              Field label is wired up with aria-labelledby rather than htmlFor. */}
          <div role="group" aria-labelledby={recurrenceLabelId}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {(["daily", "weekly", "interval"] as Mode[]).map((candidate) => (
                <Button
                  key={candidate}
                  size="sm"
                  aria-pressed={mode === candidate}
                  variant={mode === candidate ? "primary" : "secondary"}
                  onClick={() => setMode(candidate)}
                >
                  {candidate === "daily" ? t.daily : candidate === "weekly" ? t.weekly : t.interval}
                </Button>
              ))}
            </div>
            {mode === "weekly" ? (
              <div role="group" aria-label={t.weekdayGroup} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {WEEKDAYS[lang].map((label, index) => {
                  const day = index + 1;
                  return (
                    <Button
                      key={day}
                      size="sm"
                      aria-pressed={weekdays.includes(day)}
                      // `title`, not `aria-label`: the accessible name must keep
                      // containing the visible "Ср" (WCAG 2.5.3).
                      title={FULL_WEEKDAYS[lang][index]}
                      variant={weekdays.includes(day) ? "primary" : "secondary"}
                      onClick={() => setWeekdays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort())}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            {mode === "interval" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{t.every}</span>
                <Input type="number" min={1} max={365} aria-label={t.intervalAria} value={everyNDays} onChange={(event) => setEveryNDays(event.target.value)} style={{ width: 90 }} />
                <span style={{ fontSize: 13 }}>{t.days}</span>
              </div>
            ) : null}
          </div>
        </Field>

        <Field label={<span id={itemsLabelId}>{t.selectItems}</span>} required error={supplierId && selectedIds.length === 0 ? t.selectOneItem : undefined}>
          <div role="group" aria-labelledby={itemsLabelId} style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            {!supplierId || supplierItems.length === 0 ? (
              <div style={{ padding: 18, color: "var(--text-muted)", fontSize: 13 }}>{supplierId ? t.noSupplierItems : t.chooseSupplier}</div>
            ) : supplierItems.map((item, index) => {
              const checked = Object.prototype.hasOwnProperty.call(selected, item.id);
              return (
                <div key={item.id} className="plan-item-row" style={{ borderTop: index ? "1px solid var(--border-subtle)" : "none" }}>
                  <Checkbox checked={checked} onChange={(event) => toggleItem(item.id, event.target.checked)} label={<span><strong>{item.name}</strong>{item.unit ? <span style={{ color: "var(--text-muted)" }}> · {item.unit}</span> : null}</span>} />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    aria-label={`${t.quantity} — ${item.name}`}
                    placeholder={t.quantity}
                    disabled={!checked}
                    value={checked ? selected[item.id] : ""}
                    onChange={(event) => setSelected((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        </Field>

        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreSettingsId}
            onClick={() => setMoreOpen((open) => !open)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              minHeight: 44,
              padding: "9px 14px",
              border: 0,
              borderBottom: moreOpen ? "1px solid var(--border-subtle)" : undefined,
              background: moreOpen ? "var(--surface-sunken)" : "var(--surface-card)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-medium)" as unknown as number,
              color: "var(--text-strong)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <ChevronRight
              size={15}
              aria-hidden="true"
              style={{ flex: "none", color: "var(--text-muted)", transform: moreOpen ? "rotate(90deg)" : "none", transition: "transform var(--dur-fast) var(--ease-out)" }}
            />
            <span>{t.moreSettings}</span>
            {/* Nothing is hidden silently: the folded row states what it holds. */}
            {moreOpen ? null : (
              <span style={{ marginLeft: "auto", minWidth: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {summary}
              </span>
            )}
          </button>
          <div
            id={moreSettingsId}
            style={{
              display: moreOpen ? "grid" : "none",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              padding: 14,
            }}
          >
            <Field label={t.reminderTime} htmlFor={timeFieldId} required>
              <Input id={timeFieldId} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </Field>
            <Field label={t.cutoffTime} htmlFor={cutoffFieldId} hint={t.cutoffHint}>
              <Input id={cutoffFieldId} type="time" value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
            </Field>
            <Field label={t.deliveryDays} htmlFor={deliveryFieldId} hint={t.deliveryHint}>
              <Input id={deliveryFieldId} type="number" min={0} max={365} value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} />
            </Field>
            <Field label={t.escalation} htmlFor={escalationFieldId} hint={t.escalationHint}>
              <Select id={escalationFieldId} value={escalationUserId} onChange={(event) => setEscalationUserId(event.target.value)}>
                <option value="">{t.none}</option>
                {team.filter((member) => member.id !== assignedUserId).map((member) => <option key={member.id} value={member.id}>{memberOption(member)}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function ErrorBanner({ message, style = {} }: { message: string; style?: CSSProperties }) {
  return (
    <div role="alert" style={{ background: "var(--status-escalated-bg)", border: "1px solid var(--status-escalated-bd)", color: "var(--status-escalated-fg)", borderRadius: "var(--radius-md)", padding: "11px 14px", fontSize: 13, marginBottom: 16, ...style }}>
      {message}
    </div>
  );
}

function NoticeBanner({ message }: { message: string }) {
  return (
    <div role="status" style={{ background: "var(--status-confirmed-bg)", border: "1px solid var(--status-confirmed-bd)", color: "var(--status-confirmed-fg)", borderRadius: "var(--radius-md)", padding: "11px 14px", fontSize: 13, marginBottom: 16 }}>
      {message}
    </div>
  );
}
