import { DateTime } from "luxon";
import type { Recurrence } from "@poruchka/shared";

/**
 * Whether a schedule with the given recurrence is due on `date`.
 * `date` must be a luxon DateTime in the tenant's timezone (any time of day —
 * only the calendar day matters).
 */
export function recurrenceMatchesDate(
  recurrence: Recurrence,
  date: DateTime,
): boolean {
  const day = date.startOf("day");

  switch (recurrence.type) {
    case "daily":
      return true;

    case "weekly":
      // luxon weekday: 1 = Monday … 7 = Sunday (ISO)
      return recurrence.weekdays.includes(day.weekday);

    case "interval": {
      const anchor = DateTime.fromISO(recurrence.anchorDate, {
        zone: day.zone,
      }).startOf("day");
      if (!anchor.isValid) return false;
      const diffDays = Math.round(day.diff(anchor, "days").days);
      return diffDays >= 0 && diffDays % recurrence.everyNDays === 0;
    }

    default:
      return false;
  }
}
