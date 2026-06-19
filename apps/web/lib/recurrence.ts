import type { Recurrence } from "@poruchka/shared";

/** ISO weekday order (1 = Mon … 7 = Sun) for pickers and labels. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Human label for a recurrence, e.g. "Every Wed", "Every day", "Every 14 days". */
export function recurrenceLabel(r: Recurrence): string {
  if (r.type === "daily") return "Every day";
  if (r.type === "interval") return `Every ${r.everyNDays} days`;
  if (r.type === "weekly") {
    if (r.weekdays.length === 7) return "Every day";
    return "Every " + r.weekdays.map((d) => WEEKDAYS[d - 1]).join(", ");
  }
  return "";
}
