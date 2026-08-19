/**
 * Localized chat copy for the bot (English + Bulgarian), chosen per tenant.
 *
 * The Bulgarian side follows docs/BG-TERMINOLOGY.md: an OrderRule is a "план"
 * (never график/разписание), an Item is an "артикул", a nudge is a "напомняне",
 * quotes are „ … “, and nothing here says "ескалация" to the person reading it.
 */

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
    l.quantity != null ? ` (${usual}: ${l.quantity}${l.unit ? ` ${l.unit}` : ""})` : "";
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

/** Prefixed to a manually triggered test reminder so nobody mistakes it for a real order. */
export function testReminderIntro(lang: string): string {
  return L(lang) === "bg"
    ? "🧪 Тестово напомняне — така ще изглежда поръчката:"
    : "🧪 Test reminder — this is how the order will look:";
}

/** Label on the Done button. */
export function doneButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "✅ Готово" : "✅ Done";
}

/**
 * Older name for the same primary control. It delegates on purpose: the canon
 * forbids one button carrying two different words, so there is exactly one
 * string for "the order is placed".
 */
export function confirmButtonLabel(lang: string): string {
  return doneButtonLabel(lang);
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

/** One-tap "remind me in an hour" shortcut, where the full menu is too heavy. */
export function snoozeButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Напомни след 1 час" : "Remind me in 1 hour";
}

export function supplierTextButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Текст за доставчика" : "Supplier text";
}

export function skipButtonLabel(lang: string, recurrenceType?: string): string {
  if (L(lang) === "bg") {
    if (recurrenceType === "daily") return "Пропусни днес";
    if (recurrenceType === "weekly") return "Пропусни тази седмица";
    return "Пропусни тази поръчка";
  }
  if (recurrenceType === "daily") return "Skip today";
  if (recurrenceType === "weekly") return "Skip this week";
  return "Skip this order";
}

/** Ready-to-send text the responsible person can forward to the supplier. */
export function supplierOrderMessage(
  lang: string,
  p: {
    restaurant: string;
    lines: Array<{
      item: string;
      quantity: string;
      unit?: string | null;
      note?: string | null;
    }>;
  },
): string {
  const lines = p.lines
    .map((line) => {
      const amount = [line.quantity, line.unit].filter(Boolean).join(" ");
      const note = line.note?.trim() ? ` — ${line.note.trim()}` : "";
      return `- ${line.item}: ${amount}${note}`;
    })
    .join("\n");
  return L(lang) === "bg"
    ? `Здравейте,\n\nПоръчка от ${p.restaurant}:\n${lines}\n\nМоля, потвърдете поръчката.\nБлагодаря!`
    : `Hello,\n\nOrder from ${p.restaurant}:\n${lines}\n\nPlease confirm the order.\nThank you!`;
}

export function supplierTextReadyToast(lang: string): string {
  return L(lang) === "bg" ? "Текстът е готов по-долу" : "The text is ready below";
}

export function snoozedMessage(lang: string, until: string): string {
  return L(lang) === "bg"
    ? `Напомнянето е отложено до ${until}. Планът не е променен.`
    : `Reminder snoozed until ${until}. The order plan was not changed.`;
}

export function skippedMessage(lang: string, recurrenceType?: string): string {
  if (L(lang) === "bg") {
    return recurrenceType === "daily"
      ? "Днешната поръчка е пропусната. Утрешната поръчка по плана остава активна."
      : "Тази поръчка е пропусната. Следващата поръчка по плана остава активна.";
  }
  return recurrenceType === "daily"
    ? "Today's order was skipped. Tomorrow's order plan remains active."
    : "This order was skipped. The next order in the plan remains active.";
}

export function skipConfirmMessage(lang: string, recurrenceType?: string): string {
  if (L(lang) === "bg") {
    return recurrenceType === "daily"
      ? "Да пропуснем ли само днешната поръчка?"
      : "Да пропуснем ли само тази поръчка?";
  }
  return recurrenceType === "daily" ? "Skip only today's order?" : "Skip only this order?";
}

export function skipConfirmButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Да, пропусни" : "Yes, skip";
}

export function cancelButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Отказ" : "Cancel";
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

export function undoButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "↩ Отмени" : "↩ Undo";
}

export function reopenedMessage(lang: string): string {
  return L(lang) === "bg"
    ? "↩ Поръчката е отворена отново. Ще получите ново напомняне."
    : "↩ Order reopened and pending again. You'll get the reminder once more.";
}

export function cannotUndoToast(lang: string): string {
  return L(lang) === "bg" ? "Тази поръчка вече не може да се отмени" : "This order can no longer be undone";
}

export function privateChatOnlyMessage(lang: string): string {
  return L(lang) === "bg"
    ? "Отворете своята връзка в личен чат с бота, за да свържете профила си."
    : "Open your personal link in a private chat with the bot to connect your account.";
}

export function quantitiesRequiredToast(lang: string): string {
  return L(lang) === "bg"
    ? "Първо въведете количества — натиснете „Количества“"
    : "Enter quantities first — tap “Quantities”";
}

export function notYourOrderToast(lang: string): string {
  return L(lang) === "bg" ? "Тази поръчка е възложена на друг човек" : "This order is assigned to someone else";
}

/* ── Quantity editing, straight from the chat ─────────────────────────────── */

export function quantitiesButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "✏️ Количества" : "✏️ Quantities";
}

/** Header of the line picker; lists what will be ordered. */
export function quantityListMessage(
  lang: string,
  p: { supplier: string; lines: Array<{ item: string; quantity?: string | null; unit?: string | null }> },
): string {
  const body = p.lines
    .map((line) => {
      const amount = line.quantity ? [line.quantity, line.unit].filter(Boolean).join(" ") : "—";
      return `• ${line.item}: ${amount}`;
    })
    .join("\n");
  return L(lang) === "bg"
    ? `✏️ Количества — ${p.supplier}\n${body}\n\nИзберете артикул, за да смените количеството.`
    : `✏️ Quantities — ${p.supplier}\n${body}\n\nPick an item to change its amount.`;
}

/** Label for one line inside the picker keyboard. */
export function quantityLineButtonLabel(
  item: string,
  quantity?: string | null,
  unit?: string | null,
): string {
  const amount = quantity ? [quantity, unit].filter(Boolean).join(" ") : "—";
  return `${item}: ${amount}`;
}

/**
 * The numeric-entry screen for one line. The in-progress value is rendered on its
 * own "= <entry>" line so it can be read back from the message on the next tap —
 * this keeps the editor stateless and restart-safe (no server-side session).
 */
export function quantityEntryMessage(
  lang: string,
  p: { item: string; unit?: string | null; current?: string | null; entry: string },
): string {
  const unit = p.unit ? ` (${p.unit})` : "";
  const head =
    L(lang) === "bg"
      ? `✏️ ${p.item}${unit}\nСега: ${p.current ?? "—"}`
      : `✏️ ${p.item}${unit}\nCurrently: ${p.current ?? "—"}`;
  return `${head}\n\n= ${p.entry || "—"}`;
}

/** Reads back the in-progress entry rendered by quantityEntryMessage. */
export function parseQuantityEntry(text: string | undefined): string {
  const match = /^= (.*)$/m.exec(text ?? "");
  const value = match?.[1]?.trim() ?? "";
  return value === "—" ? "" : value;
}

/**
 * Applies one keypad tap to the in-progress entry. Pure so the editor's behaviour
 * is testable without Telegram. Keys: "0".."9" | "." | "b" (backspace) | "c" (clear).
 */
export function applyKeypadKey(entry: string, key: string): string {
  if (key === "b") return entry.slice(0, -1);
  if (key === "c") return "";
  if (key === ".") {
    if (entry.includes(".")) return entry;
    return entry === "" ? "0." : `${entry}.`;
  }
  if (!/^[0-9]$/.test(key)) return entry;
  // Don't allow a leading run of zeros ("007"), but keep "0." intact.
  const next = entry === "0" ? key : `${entry}${key}`;
  const [whole, fraction] = next.split(".");
  if (whole.length > 6) return entry; // matches quantitySchema max 999999
  if (fraction !== undefined && fraction.length > 3) return entry; // 3 decimal places
  return next;
}

/** Parses a finished entry into a storable quantity, or null if unusable. */
export function quantityFromEntry(entry: string): number | null {
  if (!entry || entry === ".") return null;
  const value = Number(entry);
  if (!Number.isFinite(value) || value < 0 || value > 999999) return null;
  return value;
}

export function quantitySaveButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Запази" : "Save";
}

export function quantityBackButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "‹ Назад" : "‹ Back";
}

export function quantityDoneButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Готово" : "Done";
}

export function quantitySavedToast(lang: string, item: string): string {
  return L(lang) === "bg" ? `${item} — записано` : `${item} — saved`;
}

export function quantityInvalidToast(lang: string): string {
  return L(lang) === "bg" ? "Невалидно количество" : "Invalid quantity";
}

/**
 * Sent to the backup person when the responsible one has not reacted. Deliberately
 * plain: the canon retires "ескалация" as vocabulary a kitchen manager will not parse.
 */
export function escalationMessage(
  lang: string,
  p: { supplier: string; assignee: string; dueTime: string },
): string {
  return L(lang) === "bg"
    ? `⚠ Поръчката към ${p.supplier}, възложена на ${p.assignee} за ${p.dueTime}, още не е изпратена.`
    : `⚠ The ${p.supplier} order assigned to ${p.assignee} for ${p.dueTime} has not been sent.`;
}

/**
 * Reply to a bare /start — no link code, so no tenant and no known language.
 * L() falls back to Bulgarian, which is the right default for the pilot.
 * "линк" matches the word the Team page uses for the same thing, and the person
 * reading this is staff who never open the web app, so it points at the owner
 * rather than at an admin screen they have no account for.
 */
export function startWithoutCodeMessage(lang?: string): string {
  return L(lang) === "bg"
    ? "Добре дошли в Poruchka. За да свържете този чат, отворете личния линк, който получавате от собственика на ресторанта."
    : "Welcome to Poruchka. To connect this chat, open the personal link you get from the restaurant owner.";
}

/**
 * Reply when /start carries a code that no longer resolves. Also languageless.
 * One sentence covers both causes (never valid / already used) — the reader's
 * next step is identical either way, and the distinction only invites worry.
 */
export function invalidLinkMessage(lang?: string): string {
  return L(lang) === "bg"
    ? "Този линк вече не е валиден. Помолете собственика за нов линк за свързване."
    : "This link is no longer valid. Ask the owner for a new connection link.";
}

/** Toast for a tap on a test reminder, which deliberately changes nothing. */
export function testConfirmedToast(lang?: string): string {
  return L(lang) === "bg" ? "Тестът е успешен ✓" : "Test confirmed ✓";
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
    ? "Този Telegram акаунт вече е свързан с друг човек от екипа. Помолете собственика първо да прекрати старата връзка."
    : "This Telegram account is already linked to another team member. Ask the owner to unlink it first.";
}
