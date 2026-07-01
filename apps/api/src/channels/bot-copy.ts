/** Localized chat copy for the bot (English + Bulgarian), chosen per tenant. */

export type Lang = "en" | "bg";

function L(lang: string | null | undefined): Lang {
  return lang === "en" ? "en" : "bg"; // default Bulgarian
}

export interface OrderLineCopy {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
}

/** One line of the order reminder. Quantities are optional "usual amount" hints. */
function formatLine(lang: Lang, l: OrderLineCopy): string {
  const usual = lang === "bg" ? "обичайно" : "usual";
  const qty =
    l.quantity != null
      ? ` (${usual}: ${l.quantity}${l.unit ? ` ${l.unit}` : ""})`
        : "";
  const note = l.note && l.note.trim() ? `  📝 ${l.note.trim()}` : "";
  return `• ${l.name}${qty}${note}`;
}

/** The detailed daily order reminder for a whole supplier basket. */
export function orderReminderMessage(
  lang: string,
  p: { supplier: string; lines: OrderLineCopy[]; cutoffTime?: string | null },
): string {
  const selectedLang = L(lang);
  const lines = p.lines.map((line) => formatLine(selectedLang, line)).join("\n");
  if (selectedLang === "bg") {
    const cutoff = p.cutoffTime ? `\n⏳ Подайте до ${p.cutoffTime}.` : "";
    return `🛒 Проверете поръчката към ${p.supplier}:\n${lines}${cutoff}\nНатиснете „Готово“, след като я обработите.`;
  }
  const cutoff = p.cutoffTime ? `\n⏳ Place it by ${p.cutoffTime}.` : "";
  return `🛒 Check the supplier order for ${p.supplier}:\n${lines}${cutoff}\nTap “Done” once you've handled it.`;
}

/** Label on the Done button. */
export function doneButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "✅ Готово" : "✅ Done";
}

/** Label on the Postpone button. */
export function postponeButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "⏰ Отложи" : "⏰ Postpone";
}

export type SnoozeChoice = "1h" | "tonight" | "tomorrow";

export const SNOOZE_CHOICES: SnoozeChoice[] = ["1h", "tonight", "tomorrow"];

/** Labels for the snooze options shown after tapping Postpone. */
export function snoozeOptionLabel(lang: string, choice: SnoozeChoice): string {
  const bg = L(lang) === "bg";
  switch (choice) {
    case "1h":
      return bg ? "След 1 час" : "In 1 hour";
    case "tonight":
      return bg ? "Довечера" : "Tonight";
    case "tomorrow":
      return bg ? "Утре" : "Tomorrow";
  }
}

/** Chat message sent after the order is confirmed. */
export function confirmedMessage(lang: string): string {
  return L(lang) === "bg"
    ? "✅ Отбелязано като готово — можете да проследите състоянието в приложението."
    : "✅ Marked as done — you can track the order status in the app.";
}

/** Short popup shown on the tapped Done button. */
export function confirmToast(lang: string): string {
  return L(lang) === "bg" ? "Готово ✓" : "Done ✓";
}

export function alreadyDoneToast(lang: string): string {
  return L(lang) === "bg" ? "Вече е отбелязано ✓" : "Already done ✓";
}

/** Popup shown when the order was skipped and can no longer be confirmed. */
export function skippedToast(lang: string): string {
  return L(lang) === "bg" ? "Поръчката е пропусната" : "This order was skipped";
}

/** Popup confirming a postponement, e.g. "Postponed: Tomorrow". */
export function snoozedToast(lang: string, choice: SnoozeChoice): string {
  return L(lang) === "bg"
    ? `Отложено: ${snoozeOptionLabel(lang, choice)}`
    : `Postponed: ${snoozeOptionLabel(lang, choice)}`;
}

/** Reply after a staff member links their chat via the deep link. */
export function linkedMessage(lang: string, name: string): string {
  return L(lang) === "bg"
    ? `✅ Свързано, ${name}. Тук ще получавате напомнянията за поръчки.`
    : `✅ Connected, ${name}. You'll receive your ordering reminders here.`;
}

/** Reply when a chat tries to link but is already connected to another member. */
export function chatAlreadyLinkedMessage(lang: string): string {
  return L(lang) === "bg"
    ? "Този Telegram акаунт вече е свързан с друг член на екипа. Помолете собственика да го отвърже първо."
    : "This Telegram account is already linked to another team member. Ask the owner to unlink it first.";
}
