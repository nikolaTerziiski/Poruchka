/** Localized chat copy for the bot (English + Bulgarian), chosen per tenant. */

export type Lang = "en" | "bg";

function L(lang: string | null | undefined): Lang {
  return lang === "en" ? "en" : "bg";
}

/** A supplier-level order reminder with all item quantities in one message. */
export function orderReminderMessage(
  lang: string,
  p: {
    supplier: string;
    cutoffTime?: string | null;
    lines: Array<{
      item: string;
      quantity?: string | null;
      unit?: string | null;
      note?: string | null;
    }>;
  },
): string {
  const lines = p.lines
    .map((line) => {
      const amount = [line.quantity, line.unit].filter(Boolean).join(" ");
      const note = line.note?.trim() ? ` — ${line.note.trim()}` : "";
      return `• ${line.item}${amount ? ` — ${amount}` : ""}${note}`;
    })
    .join("\n");
  if (L(lang) === "bg") {
    const cutoff = p.cutoffTime ? `\nКраен час: ${p.cutoffTime}` : "";
    return `🛒 Поръчка към ${p.supplier}\n${lines}${cutoff}\n\nНатиснете „Изпратена“, след като подадете поръчката.`;
  }
  const cutoff = p.cutoffTime ? `\nCutoff: ${p.cutoffTime}` : "";
  return `🛒 Order from ${p.supplier}\n${lines}${cutoff}\n\nTap “Sent” once you have placed the order.`;
}

export function confirmButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "✓ Изпратена" : "✓ Sent";
}

export function supplierTextButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Текст за доставчика" : "Supplier text";
}

export function snoozeButtonLabel(lang: string): string {
  return L(lang) === "bg" ? "Напомни след 1 час" : "Remind me in 1 hour";
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

export function confirmedMessage(lang: string): string {
  return L(lang) === "bg"
    ? "✓ Поръчката е отбелязана като изпратена. Потвърждението и доставката могат да се проследят в приложението."
    : "✓ Order marked as sent. Supplier confirmation and delivery can be tracked in the app.";
}

export function confirmToast(lang: string): string {
  return L(lang) === "bg" ? "Изпратена ✓" : "Sent ✓";
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

export function alreadyDoneToast(lang: string): string {
  return L(lang) === "bg" ? "Вече е отбелязана ✓" : "Already marked ✓";
}

export function quantitiesRequiredToast(lang: string): string {
  return L(lang) === "bg"
    ? "Първо въведете количества — натиснете „Количества“"
    : "Enter quantities first — tap “Quantities”";
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
  if (fraction !== undefined && fraction.length > 3) return entry; // Decimal(12,3)
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

export function notYourOrderToast(lang: string): string {
  return L(lang) === "bg" ? "Тази поръчка е възложена на друг човек" : "This order is assigned to someone else";
}

export function escalationMessage(
  lang: string,
  p: { supplier: string; assignee: string; dueTime: string },
): string {
  return L(lang) === "bg"
    ? `⚠ Поръчката към ${p.supplier}, възложена на ${p.assignee} за ${p.dueTime}, още не е изпратена.`
    : `⚠ The ${p.supplier} order assigned to ${p.assignee} for ${p.dueTime} has not been sent.`;
}

export function linkedMessage(lang: string, name: string): string {
  return L(lang) === "bg"
    ? `✓ Готово, ${name}! Тук ще получавате напомнянията за поръчките.`
    : `✓ Connected, ${name}. You'll receive your ordering reminders here.`;
}
