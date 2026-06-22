/** Localized chat copy for the bot (English + Bulgarian), chosen per tenant. */

export type Lang = "en" | "bg";

function L(lang: string | null | undefined): Lang {
  return lang === "en" ? "en" : "bg"; // default Bulgarian
}

/** The detailed daily order reminder. */
export function reminderMessage(
  lang: string,
  p: { item: string; supplier: string; unit?: string | null; note?: string | null },
): string {
  const unitPart = p.unit ? ` (${p.unit})` : "";
  const notePart = p.note && p.note.trim() ? `📝 ${p.note.trim()}\n` : "";
  if (L(lang) === "bg") {
    return `🛒 Време е за поръчка днес:\n• ${p.item}${unitPart} — от ${p.supplier}\n${notePart}Натиснете „Готово“, след като я подадете.`;
  }
  return `🛒 Time to order today:\n• ${p.item}${unitPart} — from ${p.supplier}\n${notePart}Tap “Done” once you've placed the order.`;
}

/** Label on the confirm button. */
export function confirmButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "✅ Готово" : "✅ Done";
}

/** Chat message sent after the order is confirmed. */
export function confirmedMessage(lang: string): string {
  return L(lang) === "bg"
    ? "✅ Успешно подадено като „Поръчано“ — останалото можете да проверите в приложението."
    : "✅ Successfully submitted as Ordered — you can check the rest in the app.";
}

/** Short popup shown on the tapped button. */
export function confirmToast(lang: string): string {
  return L(lang) === "bg" ? "Готово ✓" : "Done ✓";
}

export function alreadyDoneToast(lang: string): string {
  return L(lang) === "bg" ? "Вече е отбелязано ✓" : "Already done ✓";
}

/** Popup shown when the order was cancelled and can no longer be confirmed. */
export function cancelledToast(lang: string): string {
  return L(lang) === "bg" ? "Поръчката е отменена" : "This order was cancelled";
}

/** Reply when a chat tries to link but is already connected to another member. */
export function chatAlreadyLinkedMessage(lang: string): string {
  return L(lang) === "bg"
    ? "Този Telegram акаунт вече е свързан с друг член на екипа. Помолете собственика да го отвърже първо."
    : "This Telegram account is already linked to another team member. Ask the owner to unlink it first.";
}

/** Reply after a staff member links their chat via the deep link. */
export function linkedMessage(lang: string, name: string): string {
  return L(lang) === "bg"
    ? `✅ Свързано, ${name}. Тук ще получавате напомнянията за поръчки.`
    : `✅ Connected, ${name}. You'll receive your ordering reminders here.`;
}
