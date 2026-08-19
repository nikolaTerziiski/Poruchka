"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardList,
  Clock3,
  SkipForward,
  Truck,
} from "lucide-react";
import type { OrderRunStatus, ReceivingException, Recurrence } from "@poruchka/shared";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Dialog } from "@/components/ds/Dialog";
import { EmptyState } from "@/components/ds/EmptyState";
import { Field } from "@/components/ds/Field";
import { Input } from "@/components/ds/Input";
import { PageHead } from "@/components/ds/PageHead";
import { Select } from "@/components/ds/Select";
import { api } from "@/lib/api";
import { apiErrorText, useApiError, useCommon, useLang, useTr, type Lang } from "@/lib/i18n";

type DecimalValue = string | number | null;

interface OrderLine {
  id: string;
  itemId: string;
  itemNameSnapshot: string;
  quantitySnapshot: DecimalValue;
  unitSnapshot: string | null;
  notesSnapshot: string | null;
  receivedQuantity: DecimalValue;
  unitPrice: DecimalValue;
  exceptionType: ReceivingException | null;
  exceptionNote: string | null;
  previousUnitPrice: number | null;
  priceChangePercent: number | null;
}

interface OrderRun {
  id: string;
  dueDate: string;
  dueAt: string;
  expectedDeliveryDate: string | null;
  status: OrderRunStatus;
  supplierConfirmedAt: string | null;
  supplierReference: string | null;
  receivedAt: string | null;
  receivingNote: string | null;
  supplier: { id: string; name: string; contact: string | null };
  assignedUser: { id: string; name: string };
  submittedByUser: { id: string; name: string } | null;
  orderRule: { cutoffTime: string | null; recurrence: Recurrence };
  lines: OrderLine[];
}

const M = {
  en: {
    title: "Supplier orders",
    subtitle: "Prepare quantities, copy the supplier text, and track every recurring order",
    today: "Today",
    prev: "Previous week",
    next: "Next week",
    loading: "Preparing supplier orders…",
    loadFailed: "Could not load supplier orders.",
    emptyTitle: "No supplier orders this week",
    emptyDesc: "Create an order plan and Poruchka will prepare each due supplier basket automatically.",
    createPlan: "Create order plan",
    open: "Open",
    sent: "Sent / confirmed",
    deliveries: "Received",
    due: "Due",
    cutoff: "Cutoff",
    expected: "Expected",
    assigned: "Responsible",
    item: "Item",
    quantity: "Quantity",
    basedOnLast: "Prefilled from the last order when available",
    savedAt: (time: string) => `Saved at ${time}`,
    copyOrder: "Copy supplier text",
    copyTitle: "Supplier message",
    copyDescription: "Copy this text and send it to the supplier in Viber or your usual channel.",
    copyAction: "Copy text",
    copied: "Supplier text copied",
    copyFailed: "The supplier text could not be copied.",
    // One word, and the same one the Telegram button uses ("✓ Sent",
    // bot-copy.ts:39), so the phone and the web call this action by one name.
    // The nuance the old "sent elsewhere" carried moved into markSentHint.
    markSent: "Sent",
    markSentHint: "Mark the order as sent once you have placed it with the supplier.",
    snooze: "Remind in 1 hour",
    snoozed: "Reminder snoozed for 1 hour. The recurring plan was not changed.",
    skipToday: "Skip today",
    skipWeek: "Skip this week",
    skipOccurrence: "Skip this occurrence",
    skipTitle: "Skip this order?",
    skipDailyDescription: "Only today's order will be skipped. Tomorrow's daily plan remains active.",
    skipWeeklyDescription: "Only this week's order will be skipped. The next scheduled week remains active.",
    skipOccurrenceDescription: "Only this occurrence will be skipped. The recurring plan remains active.",
    skipReason: "Reason (optional)",
    skipAction: "Skip order",
    supplierConfirmed: "Supplier confirmed",
    receive: "Receive delivery",
    saveFailed: "The order could not be updated.",
    enterQuantity: "Enter at least one quantity.",
    quantityAria: (name: string) => `Quantity for ${name}`,
    confirmTitle: "Supplier confirmation",
    reference: "Reference / confirmation number",
    deliveryDate: "Expected delivery date",
    confirmAction: "Save confirmation",
    receiveTitle: (supplier: string) => `Receive delivery from ${supplier}`,
    ordered: "Ordered",
    received: "Received",
    unitPrice: (currency: string) => `Unit price (${currency})`,
    issue: "Issue",
    noIssue: "No issue",
    issueNote: "Issue note",
    receivingNote: "Delivery note",
    saveReceiving: "Save receiving",
    // The caller passes an already absolute, already locale-formatted number —
    // see PriceChange, which must not print "12.5" to a Bulgarian reader.
    priceUp: (percent: string) => `Price up ${percent}% vs previous delivery`,
    priceDown: (percent: string) => `Price down ${percent}% vs previous delivery`,
    total: "Total",
    // Keyed by the ReceivingException union: adding a fifth member to
    // receivingExceptionSchema fails the build until it has a label here.
    exception: {
      SHORT: "Short quantity",
      MISSING: "Missing",
      DAMAGED: "Damaged",
      SUBSTITUTED: "Substituted",
    },
    status: {
      PENDING: "To prepare",
      SUBMITTED: "Sent",
      ESCALATED: "Overdue",
      SKIPPED: "Skipped",
      CONFIRMED: "Supplier confirmed",
      PARTIALLY_RECEIVED: "Partly received",
      RECEIVED: "Received",
    },
  },
  bg: {
    title: "Поръчки към доставчици",
    subtitle: "Подгответе количествата, копирайте текста и проследете всяка поръчка",
    today: "Днес",
    prev: "Предходна седмица",
    next: "Следваща седмица",
    loading: "Подготовка на поръчките…",
    loadFailed: "Поръчките не можаха да бъдат заредени.",
    emptyTitle: "Няма поръчки към доставчици тази седмица",
    emptyDesc: "Създайте план и Poruchka автоматично ще подготвя всяка предстояща поръчка.",
    createPlan: "Създай план",
    open: "Отворени",
    sent: "Изпратени / потвърдени",
    deliveries: "Приети",
    // Not the bare preposition "За" — a preposition is not a label
    // (docs/BG-TERMINOLOGY.md, style rule 6).
    due: "Дата",
    cutoff: "Краен час",
    expected: "Очаквана доставка",
    assigned: "Отговорник",
    item: "Артикул",
    quantity: "Количество",
    basedOnLast: "Попълнено от последната поръчка, когато има такава",
    savedAt: (time: string) => `Запазено в ${time}`,
    copyOrder: "Копирай текст за доставчика",
    copyTitle: "Съобщение към доставчика",
    copyDescription: "Копирайте текста и го изпратете във Viber или по обичайния канал на доставчика.",
    copyAction: "Копирай текста",
    copied: "Текстът за доставчика е копиран",
    copyFailed: "Текстът за доставчика не можа да бъде копиран.",
    // Exactly the word on the Telegram button ("✓ Изпратена", bot-copy.ts:39) and
    // in the status chip below, so one action has one name on the phone and here.
    // "другаде" asked "къде другаде?" and answered nothing; the explanation now
    // lives in markSentHint instead of on the button face.
    markSent: "Изпратена",
    markSentHint: "Отбележете поръчката като изпратена, ако вече сте я подали на доставчика.",
    snooze: "Напомни след 1 час",
    snoozed: "Напомнянето е отложено с 1 час. Повтарящият се план не е променен.",
    skipToday: "Пропусни днес",
    skipWeek: "Пропусни тази седмица",
    skipOccurrence: "Пропусни тази поръчка",
    skipTitle: "Да пропуснем ли тази поръчка?",
    skipDailyDescription: "Пропуска се само днешната поръчка. Утрешният дневен план остава активен.",
    skipWeeklyDescription: "Пропуска се само поръчката за тази седмица. Следващата остава активна.",
    skipOccurrenceDescription: "Пропуска се само тази поръчка. Повтарящият се план остава активен.",
    // „по избор“ is the canonical form — it is what COMMON.optional says.
    skipReason: "Причина (по избор)",
    skipAction: "Пропусни поръчката",
    supplierConfirmed: "Доставчикът потвърди",
    receive: "Приеми доставката",
    saveFailed: "Поръчката не можа да бъде обновена.",
    enterQuantity: "Въведете поне едно количество.",
    quantityAria: (name: string) => `Количество за ${name}`,
    confirmTitle: "Потвърждение от доставчика",
    reference: "Номер / референция",
    deliveryDate: "Очаквана дата за доставка",
    confirmAction: "Запази потвърждението",
    receiveTitle: (supplier: string) => `Приемане на доставка от ${supplier}`,
    ordered: "Поръчано",
    received: "Получено",
    unitPrice: (currency: string) => `Единична цена (${currency})`,
    issue: "Проблем",
    noIssue: "Без проблем",
    issueNote: "Бележка за проблема",
    receivingNote: "Бележка за доставката",
    saveReceiving: "Запази приемането",
    // "нагоре/надолу с X%" is a calque of "price up X%". Kitchen staff say
    // по-скъпо / по-евтино, and it is shorter for the 11.5px badge.
    priceUp: (percent: string) => `С ${percent}% по-скъпо от предходната доставка`,
    priceDown: (percent: string) => `С ${percent}% по-евтино от предходната доставка`,
    total: "Обща сума",
    exception: {
      SHORT: "По-малко количество",
      MISSING: "Липсва",
      DAMAGED: "Повредено",
      // "Заменено" is what a supplier swapping in another product does;
      // "Заместено" reads as standing in for someone.
      SUBSTITUTED: "Заменено",
    },
    status: {
      PENDING: "За подготовка",
      SUBMITTED: "Изпратена",
      // docs/BG-TERMINOLOGY.md retires the escalation jargon: the status word is
      // „Просрочена“, and it must match the dashboard calendar chip.
      ESCALATED: "Просрочена",
      SKIPPED: "Пропусната",
      CONFIRMED: "Потвърдена",
      PARTIALLY_RECEIVED: "Частично приета",
      RECEIVED: "Приета",
    },
  },
} as const;

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - mondayOffset);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function formatDate(value: string, lang: Lang): string {
  return dateOnly(value).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function formatTime(value: Date, lang: Lang): string {
  return value.toLocaleTimeString(lang === "bg" ? "bg-BG" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Bulgaria has been on the euro since 2026-01-01, so every price on this page is
 * in it. One constant, so a per-tenant currency setting replaces a single line —
 * and so no bare number with an English decimal point ever reaches a Bulgarian
 * reader (docs/BG-TERMINOLOGY.md, style rule 9).
 */
const CURRENCY = "EUR";

function formatMoney(value: number, lang: Lang): string {
  return value.toLocaleString(lang === "bg" ? "bg-BG" : "en-GB", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
  });
}

/** The symbol on its own, for input labels ("Единична цена (€)"). Derived from
 *  CURRENCY rather than written out, so the two can never drift apart. */
function currencySymbol(lang: Lang): string {
  return (
    new Intl.NumberFormat(lang === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency: CURRENCY })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? CURRENCY
  );
}

function statusTone(status: OrderRunStatus): "neutral" | "accent" | "confirmed" | "pending" | "escalated" {
  if (status === "ESCALATED") return "escalated";
  if (status === "PENDING" || status === "PARTIALLY_RECEIVED") return "pending";
  if (status === "SUBMITTED") return "accent";
  if (status === "CONFIRMED" || status === "RECEIVED") return "confirmed";
  return "neutral";
}

export default function OrdersPage() {
  const router = useRouter();
  const t = useTr(M);
  const lang = useLang();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  // Deep link from the dashboard calendar: /orders?run=<id>&week=<Monday, ISO>.
  // Which order to scroll to once the week it belongs to has loaded.
  const [targetRunId, setTargetRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<OrderRun[]>([]);
  // Which week the cards on screen belong to, rather than a plain `loading` flag:
  // a refetch of the SAME week must leave the cards mounted, or every quantity
  // typed into them is lost with the unmount. Only moving to another week (or the
  // very first load) may replace them with the placeholder.
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekKey = toISODate(weekStart);

  // Localized copy is read through refs. If `t` or `lang` were in `load`'s dep
  // array, flipping the BG/EN switch would give `load` a new identity, refire the
  // effect, refetch the week and wipe every unsaved quantity on the page.
  const tRef = useRef(t);
  const langRef = useRef(lang);
  tRef.current = t;
  langRef.current = lang;
  // Guards against out-of-order responses when the week arrows are clicked twice.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const requestedWeek = toISODate(weekStart);
    setError(null);
    try {
      const data = await api<OrderRun[]>(`/order-runs?from=${requestedWeek}&to=${toISODate(weekEnd)}`);
      if (requestId.current !== id) return;
      setRuns(data);
    } catch (cause) {
      if (requestId.current !== id) return;
      // Drop the previous week's cards: leaving them under the new week's header
      // would show the wrong orders for the dates in the title.
      setRuns([]);
      setError(apiErrorText(cause, langRef.current, tRef.current.loadFailed));
    } finally {
      if (requestId.current === id) setLoadedWeek(requestedWeek);
    }
  }, [weekEnd, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  // Read the deep-link params on mount rather than in the useState initializer:
  // this page is prerendered, so touching window during the first render would
  // make the server HTML and the first client render disagree. One extra fetch
  // when the link points at another week is the price of that safety.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const week = params.get("week");
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
      const target = startOfWeek(dateOnly(week));
      setWeekStart((current) => (toISODate(current) === toISODate(target) ? current : target));
    }
    const run = params.get("run");
    if (run) setTargetRunId(run);
  }, []);

  // Scroll only after the week has actually loaded — on mount the card does not
  // exist yet. Cleared either way so a later refetch does not yank the page.
  useEffect(() => {
    if (!targetRunId || loadedWeek !== weekKey) return;
    document.getElementById(`run-${targetRunId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    setTargetRunId(null);
  }, [targetRunId, loadedWeek, weekKey]);

  const counts = {
    open: runs.filter((run) => run.status === "PENDING" || run.status === "ESCALATED").length,
    sent: runs.filter((run) => ["SUBMITTED", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(run.status)).length,
    received: runs.filter((run) => run.status === "RECEIVED").length,
  };
  const rangeLabel = `${weekStart.toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", { day: "numeric", month: "short" })}`;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1120, margin: "0 auto" }}>
      <PageHead
        title={t.title}
        subtitle={`${t.subtitle} · ${rangeLabel}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" icon={<ChevronLeft size={16} />} aria-label={t.prev} onClick={() => setWeekStart((current) => addDays(current, -7))} />
            <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>{t.today}</Button>
            <Button variant="secondary" icon={<ChevronRight size={16} />} aria-label={t.next} onClick={() => setWeekStart((current) => addDays(current, 7))} />
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 22 }}>
        <Summary label={t.open} value={counts.open} tone="pending" />
        <Summary label={t.sent} value={counts.sent} tone="accent" />
        <Summary label={t.deliveries} value={counts.received} tone="confirmed" />
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {loadedWeek !== weekKey ? (
        <div role="status" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>{t.loading}</div>
      ) : runs.length === 0 ? (
        // After a failed load "no orders this week" would be a lie — the banner
        // above already says what happened.
        error ? null : (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title={t.emptyTitle}
            description={t.emptyDesc}
            action={<Button onClick={() => router.push("/schedules")}>{t.createPlan}</Button>}
          />
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {runs.map((run) => <OrderCard key={run.id} run={run} lang={lang} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ run, lang, onChanged }: { run: OrderRun; lang: Lang; onChanged: () => Promise<void> }) {
  const t = useTr(M);
  const errText = useApiError();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [supplierMessage, setSupplierMessage] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Only a keystroke marks the draft dirty, so neither the reset effect below nor
  // a background refetch can trigger a save the user never asked for.
  const dirty = useRef(false);
  const quantitiesRef = useRef(quantities);
  quantitiesRef.current = quantities;

  // Deliberately keyed on run.id/run.status, NOT on `run`: a refetch caused by
  // another card (or by an edit made in Telegram) must not overwrite the numbers
  // someone is typing right now. The person in front of the screen wins until the
  // order itself moves on.
  useEffect(() => {
    setQuantities(Object.fromEntries(run.lines.map((line) => [line.id, line.quantitySnapshot === null ? "" : String(line.quantitySnapshot)])));
    dirty.current = false;
    // Reacting to `run.lines` would overwrite what someone is typing on every
    // background refetch, so the narrow dep list above is the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, run.status]);

  const editable = run.status === "PENDING" || run.status === "ESCALATED";
  const skipLabel =
    run.orderRule.recurrence.type === "daily"
      ? t.skipToday
      : run.orderRule.recurrence.type === "weekly"
        ? t.skipWeek
        : t.skipOccurrence;

  const saveDraft = useCallback(async () => {
    await api(`/order-runs/${run.id}/draft`, {
      method: "PATCH",
      body: JSON.stringify({
        lines: run.lines.map((line) => {
          const value = quantitiesRef.current[line.id];
          return { lineId: line.id, quantity: value === undefined || value === "" ? null : Number(value) };
        }),
      }),
    });
  }, [run.id, run.lines]);

  const autosave = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    try {
      await saveDraft();
      setSavedAt(new Date());
    } catch {
      // Stay dirty so the next keystroke, the next blur or the copy/submit path
      // retries — those two save again and DO surface the error. A banner thrown
      // up while someone is still typing would be noise.
      dirty.current = true;
    }
  }, [saveDraft]);

  // Debounced draft autosave, replacing the old "Запази количествата" button.
  // It must never set `busy`: that disables the whole action row, so the buttons
  // would flicker dead every time a digit is typed.
  useEffect(() => {
    if (!editable || !dirty.current) return;
    const timer = setTimeout(() => void autosave(), 800);
    return () => clearTimeout(timer);
  }, [quantities, editable, autosave]);

  const submit = async () => {
    if (!Object.values(quantities).some((value) => Number(value) > 0)) {
      setError(t.enterQuantity);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveDraft();
      dirty.current = false;
      await api(`/order-runs/${run.id}/submit`, { method: "POST" });
      await onChanged();
    } catch (cause) {
      setError(errText(cause, t.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  const prepareSupplierMessage = async () => {
    if (!Object.values(quantities).some((value) => Number(value) > 0)) {
      setError(t.enterQuantity);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveDraft();
      dirty.current = false;
      const result = await api<{ text: string }>(`/order-runs/${run.id}/supplier-message`);
      setSupplierMessage(result.text);
    } catch (cause) {
      setError(errText(cause, t.copyFailed));
    } finally {
      setBusy(false);
    }
  };

  const snooze = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/order-runs/${run.id}/snooze`, {
        method: "POST",
        body: JSON.stringify({ minutes: 60 }),
      });
      setNotice(t.snoozed);
    } catch (cause) {
      setError(errText(cause, t.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  const copied = () => {
    setSupplierMessage(null);
    setNotice(t.copied);
  };

  const total = run.lines.reduce((sum, line) => {
    const quantity = Number(line.receivedQuantity ?? 0);
    const price = Number(line.unitPrice ?? 0);
    return sum + quantity * price;
  }, 0);

  return (
    // The id is the scroll target for a dashboard chip; the margin keeps the card
    // header clear of the sticky app bar once it lands.
    <Card id={`run-${run.id}`} pad="none" style={{ overflow: "hidden", scrollMarginTop: 72 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19 }}>{run.supplier.name}</h2>
            <Badge tone={statusTone(run.status)} dot>{t.status[run.status]}</Badge>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 7, color: "var(--text-muted)", fontSize: 12.5, flexWrap: "wrap" }}>
            <span>{t.due}: <strong style={{ color: "var(--text-body)" }}>{formatDate(run.dueDate, lang)}</strong></span>
            {run.orderRule.cutoffTime ? <span>{t.cutoff}: {run.orderRule.cutoffTime}</span> : null}
            {run.expectedDeliveryDate ? <span>{t.expected}: {formatDate(run.expectedDeliveryDate, lang)}</span> : null}
            <span>{t.assigned}: {run.assignedUser.name}</span>
          </div>
        </div>
        <OrderActions
          run={run}
          busy={busy}
          onCopy={() => void prepareSupplierMessage()}
          onSubmit={() => void submit()}
          onConfirm={() => setConfirming(true)}
          onReceive={() => setReceiving(true)}
        />
      </div>

      {error || notice ? (
        <div role={error ? "alert" : "status"} style={{ padding: "10px 20px", fontSize: 13, color: error ? "var(--status-escalated-fg)" : "var(--status-confirmed-fg)", background: error ? "var(--status-escalated-bg)" : "var(--status-confirmed-bg)" }}>
          {error ?? notice}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead>
            <tr style={{ background: "var(--surface-sunken)", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th scope="col" style={thStyle}>{t.item}</th>
              <th scope="col" style={{ ...thStyle, width: 180 }}>{t.quantity}</th>
              <th scope="col" style={thStyle}>{run.status === "RECEIVED" || run.status === "PARTIALLY_RECEIVED" ? t.received : ""}</th>
            </tr>
          </thead>
          <tbody>
            {run.lines.map((line, index) => (
              <tr key={line.id} style={{ borderTop: index ? "1px solid var(--border-subtle)" : "none" }}>
                {/* A row header, so a screen reader announces the item name with
                    every cell in the row. The resets are needed because <th>
                    defaults to bold and centred and tdStyle sets neither. */}
                <th scope="row" style={{ ...tdStyle, textAlign: "left", fontWeight: 400 }}>
                  <strong style={{ color: "var(--text-strong)" }}>{line.itemNameSnapshot}</strong>
                  {line.notesSnapshot ? <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{line.notesSnapshot}</div> : null}
                </th>
                <td style={tdStyle}>
                  {editable ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={t.quantityAria(line.itemNameSnapshot)}
                        value={quantities[line.id] ?? ""}
                        onChange={(event) => {
                          dirty.current = true;
                          setQuantities((current) => ({ ...current, [line.id]: event.target.value }));
                        }}
                        onBlur={() => void autosave()}
                        style={{ width: 110 }}
                      />
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{line.unitSnapshot}</span>
                    </div>
                  ) : (
                    <span>{String(line.quantitySnapshot ?? "—")} {line.unitSnapshot}</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {/* The exception is NOT nested under receivedQuantity: clearing
                      the quantity is exactly how "Липсва" gets recorded, and that
                      used to hide both the problem and its note. */}
                  {line.receivedQuantity !== null ? (
                    <div>{String(line.receivedQuantity)} {line.unitSnapshot}{line.unitPrice !== null ? ` × ${formatMoney(Number(line.unitPrice), lang)}` : ""}</div>
                  ) : null}
                  {line.exceptionType ? (
                    <div style={{ color: "var(--status-escalated-fg)", fontSize: 12, marginTop: 3 }}>
                      {t.exception[line.exceptionType]}{line.exceptionNote ? ` · ${line.exceptionNote}` : ""}
                    </div>
                  ) : null}
                  {line.receivedQuantity !== null && line.priceChangePercent !== null && Math.abs(line.priceChangePercent) >= 5 ? (
                    <PriceChange value={line.priceChangePercent} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The quiet line: the prefill hint and the autosave marker on the left,
          the two rarely-used actions on the right. Keeping "Напомни след 1 час"
          and "Пропусни…" out of the header is what lets the header hold a single
          primary action instead of a five-button wall. */}
      {editable ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "8px 14px 12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", color: "var(--text-muted)", fontSize: 12 }}>
            <span>{t.basedOnLast}</span>
            <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--status-confirmed-fg)" }}>
              {savedAt ? (
                <>
                  <Check size={13} />
                  {t.savedAt(formatTime(savedAt, lang))}
                </>
              ) : null}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Button size="sm" variant="ghost" icon={<Clock3 size={15} />} disabled={busy} onClick={() => void snooze()}>{t.snooze}</Button>
            <Button size="sm" variant="ghost" icon={<SkipForward size={15} />} disabled={busy} onClick={() => setSkipping(true)}>{skipLabel}</Button>
          </div>
        </div>
      ) : null}
      {run.status === "RECEIVED" && total > 0 ? (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", fontSize: 13 }}>
          {t.total}: <strong style={{ marginLeft: 8, fontFamily: "var(--font-mono)" }}>{formatMoney(total, lang)}</strong>
        </div>
      ) : null}

      {confirming ? <SupplierConfirmDialog run={run} onClose={() => setConfirming(false)} onSaved={onChanged} /> : null}
      {receiving ? <ReceiveDialog run={run} onClose={() => setReceiving(false)} onSaved={onChanged} /> : null}
      {supplierMessage ? (
        <SupplierMessageDialog
          text={supplierMessage}
          onClose={() => setSupplierMessage(null)}
          onCopied={copied}
        />
      ) : null}
      {skipping ? (
        <SkipOrderDialog
          run={run}
          onClose={() => setSkipping(false)}
          onSkipped={async () => {
            setSkipping(false);
            await onChanged();
          }}
        />
      ) : null}
    </Card>
  );
}

/**
 * The card header carries the one action the user came to do, plus the one that
 * closes the order. Saving is automatic now (see OrderCard.autosave), and snooze
 * and skip live on the quiet line under the table.
 */
function OrderActions({
  run,
  busy,
  onCopy,
  onSubmit,
  onConfirm,
  onReceive,
}: {
  run: OrderRun;
  busy: boolean;
  onCopy: () => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onReceive: () => void;
}) {
  const t = useTr(M);
  if (run.status === "PENDING" || run.status === "ESCALATED") {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Button icon={<ClipboardCopy size={16} />} disabled={busy} onClick={onCopy}>{t.copyOrder}</Button>
        <Button variant="secondary" icon={<Check size={16} />} disabled={busy} title={t.markSentHint} onClick={onSubmit}>{t.markSent}</Button>
      </div>
    );
  }
  if (run.status === "SUBMITTED") {
    return <div style={{ display: "flex", gap: 8 }}><Button variant="secondary" onClick={onConfirm}>{t.supplierConfirmed}</Button><Button icon={<Truck size={16} />} onClick={onReceive}>{t.receive}</Button></div>;
  }
  if (run.status === "CONFIRMED" || run.status === "PARTIALLY_RECEIVED") {
    return <Button icon={<Truck size={16} />} onClick={onReceive}>{t.receive}</Button>;
  }
  return null;
}

function SupplierMessageDialog({
  text,
  onClose,
  onCopied,
}: {
  text: string;
  onClose: () => void;
  onCopied: () => void;
}) {
  const t = useTr(M);
  const c = useCommon();
  const [error, setError] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      setError(t.copyFailed);
    }
  };

  return (
    <Dialog
      title={t.copyTitle}
      description={t.copyDescription}
      confirmLabel={t.copyAction}
      cancelLabel={c.close}
      width={620}
      onCancel={onClose}
      onConfirm={() => void copy()}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <textarea
        aria-label={t.copyTitle}
        readOnly
        value={text}
        rows={10}
        style={{
          width: "100%",
          resize: "vertical",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-sunken)",
          color: "var(--text-strong)",
          font: "500 14px/1.6 var(--font-sans)",
          padding: 14,
        }}
      />
    </Dialog>
  );
}

function SkipOrderDialog({
  run,
  onClose,
  onSkipped,
}: {
  run: OrderRun;
  onClose: () => void;
  onSkipped: () => Promise<void>;
}) {
  const t = useTr(M);
  const c = useCommon();
  const errText = useApiError();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const recurrenceType = run.orderRule.recurrence.type;
  const description =
    recurrenceType === "daily"
      ? t.skipDailyDescription
      : recurrenceType === "weekly"
        ? t.skipWeeklyDescription
        : t.skipOccurrenceDescription;

  const skip = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/order-runs/${run.id}/skip`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      await onSkipped();
    } catch (cause) {
      setError(errText(cause, t.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={t.skipTitle}
      description={description}
      confirmLabel={t.skipAction}
      cancelLabel={c.cancel}
      tone="danger"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => void skip()}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <Field label={t.skipReason} htmlFor={reasonId}>
        <Input id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </Dialog>
  );
}

function SupplierConfirmDialog({ run, onClose, onSaved }: { run: OrderRun; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = useTr(M);
  const c = useCommon();
  const errText = useApiError();
  const [reference, setReference] = useState(run.supplierReference ?? "");
  const [deliveryDate, setDeliveryDate] = useState(run.expectedDeliveryDate?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const referenceId = `${uid}-reference`;
  const deliveryDateId = `${uid}-delivery-date`;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/order-runs/${run.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ supplierReference: reference || null, expectedDeliveryDate: deliveryDate || null }),
      });
      onClose();
      await onSaved();
    } catch (cause) {
      setError(errText(cause, t.saveFailed));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={t.confirmTitle} confirmLabel={t.confirmAction} cancelLabel={c.cancel} busy={busy} onCancel={onClose} onConfirm={() => void save()}>
      {error ? <ErrorBanner message={error} /> : null}
      <div style={{ display: "grid", gap: 14 }}>
        {/* Field renders its <label> as a sibling, not a wrapper, so every input
            needs an explicit id or it has no accessible name at all. */}
        <Field label={t.reference} htmlFor={referenceId}><Input id={referenceId} value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
        <Field label={t.deliveryDate} htmlFor={deliveryDateId}><Input id={deliveryDateId} type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

type ReceivingRow = { received: string; price: string; exception: "" | ReceivingException; note: string };

function ReceiveDialog({ run, onClose, onSaved }: { run: OrderRun; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = useTr(M);
  const c = useCommon();
  const lang = useLang();
  const errText = useApiError();
  const uid = useId();
  const orderedLines = run.lines.filter((line) => Number(line.quantitySnapshot ?? 0) > 0);
  const [rows, setRows] = useState<Record<string, ReceivingRow>>(() => Object.fromEntries(orderedLines.map((line) => [line.id, {
    received: line.receivedQuantity === null ? String(line.quantitySnapshot ?? "") : String(line.receivedQuantity),
    price: line.unitPrice === null ? "" : String(line.unitPrice),
    exception: line.exceptionType ?? "",
    note: line.exceptionNote ?? "",
  }])));
  const [receivingNote, setReceivingNote] = useState(run.receivingNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (lineId: string, patch: Partial<ReceivingRow>) => setRows((current) => ({ ...current, [lineId]: { ...current[lineId], ...patch } }));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/order-runs/${run.id}/receive`, {
        method: "POST",
        body: JSON.stringify({
          receivingNote: receivingNote || null,
          lines: orderedLines.map((line) => ({
            lineId: line.id,
            receivedQuantity: rows[line.id].received === "" ? null : Number(rows[line.id].received),
            unitPrice: rows[line.id].price === "" ? null : Number(rows[line.id].price),
            exceptionType: rows[line.id].exception || null,
            exceptionNote: rows[line.id].note || null,
          })),
        }),
      });
      onClose();
      await onSaved();
    } catch (cause) {
      setError(errText(cause, t.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={t.receiveTitle(run.supplier.name)} confirmLabel={t.saveReceiving} cancelLabel={c.cancel} width={820} busy={busy} onCancel={onClose} onConfirm={() => void save()}>
      {error ? <ErrorBanner message={error} /> : null}
      <div style={{ display: "grid", gap: 10 }}>
        {orderedLines.map((line) => {
          // Field renders its <label> beside the control rather than around it,
          // so without a per-line id the same three labels repeat for every item
          // and none of them names an input.
          const receivedId = `${uid}-received-${line.id}`;
          const priceId = `${uid}-price-${line.id}`;
          const issueId = `${uid}-issue-${line.id}`;
          const noteId = `${uid}-note-${line.id}`;
          return (
            <div key={line.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <strong>{line.itemNameSnapshot}</strong>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.ordered}: {String(line.quantitySnapshot)} {line.unitSnapshot}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
                <Field label={t.received} htmlFor={receivedId}><Input id={receivedId} type="number" min={0} step="any" value={rows[line.id].received} onChange={(event) => update(line.id, { received: event.target.value })} /></Field>
                <Field label={t.unitPrice(currencySymbol(lang))} htmlFor={priceId}><Input id={priceId} type="number" min={0} step="0.01" value={rows[line.id].price} onChange={(event) => update(line.id, { price: event.target.value })} /></Field>
                <Field label={t.issue} htmlFor={issueId}>
                  <Select id={issueId} value={rows[line.id].exception} onChange={(event) => update(line.id, { exception: event.target.value as ReceivingRow["exception"] })}>
                    <option value="">{t.noIssue}</option>
                    <option value="SHORT">{t.exception.SHORT}</option>
                    <option value="MISSING">{t.exception.MISSING}</option>
                    <option value="DAMAGED">{t.exception.DAMAGED}</option>
                    <option value="SUBSTITUTED">{t.exception.SUBSTITUTED}</option>
                  </Select>
                </Field>
                <Field label={t.issueNote} htmlFor={noteId}><Input id={noteId} value={rows[line.id].note} disabled={!rows[line.id].exception} onChange={(event) => update(line.id, { note: event.target.value })} /></Field>
              </div>
            </div>
          );
        })}
        <Field label={t.receivingNote} htmlFor={`${uid}-receiving-note`}><Input id={`${uid}-receiving-note`} value={receivingNote} onChange={(event) => setReceivingNote(event.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: "pending" | "accent" | "confirmed" }) {
  // The semantic accent tokens, not the raw brand steps this used to reach for.
  const colors = tone === "accent"
    ? { bg: "var(--accent-soft)", border: "var(--accent-soft-border)", dot: "var(--accent)" }
    : { bg: `var(--status-${tone}-bg)`, border: `var(--status-${tone}-bd)`, dot: `var(--status-${tone}-dot)` };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", border: `1px solid ${colors.border}`, borderRadius: "var(--radius-xl)", background: "var(--surface-card)" }}>
      <span style={{ width: 34, height: 34, borderRadius: "var(--radius-md)", background: colors.bg, border: `1px solid ${colors.border}`, display: "grid", placeItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot }} /></span>
      <div><strong style={{ display: "block", fontSize: 20 }}>{value}</strong><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{label}</span></div>
    </div>
  );
}

function PriceChange({ value }: { value: number }) {
  const t = useTr(M);
  const lang = useLang();
  const increased = value > 0;
  // The API sends one decimal (12.5), which must not reach a Bulgarian reader
  // with an English decimal point. Sign is carried by the wording, not the digits.
  const percent = Math.abs(value).toLocaleString(lang === "bg" ? "bg-BG" : "en-GB", { maximumFractionDigits: 1 });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 11.5, color: increased ? "var(--status-escalated-fg)" : "var(--status-confirmed-fg)" }}>
      {increased ? <AlertTriangle size={13} /> : <Check size={13} />}
      {increased ? t.priceUp(percent) : t.priceDown(percent)}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <div role="alert" style={{ marginBottom: 14, padding: "11px 14px", border: "1px solid var(--status-escalated-bd)", borderRadius: "var(--radius-md)", color: "var(--status-escalated-fg)", background: "var(--status-escalated-bg)", fontSize: 13 }}>{message}</div>;
}

const thStyle = { textAlign: "left" as const, padding: "10px 20px", fontWeight: 600 };
const tdStyle = { padding: "13px 20px", fontSize: 13.5, verticalAlign: "middle" as const };
