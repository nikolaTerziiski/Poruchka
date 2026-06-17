import { z } from "zod";

/** ISO weekday: 1 = Monday … 7 = Sunday (matches luxon's DateTime.weekday). */
export const isoWeekdaySchema = z.number().int().min(1).max(7);

/**
 * How often a good needs to be ordered. Fully customizable per item:
 *  - daily:    every day
 *  - weekly:   on the listed ISO weekdays (e.g. [3] = every Wednesday)
 *  - interval: every N days counted from an anchor date
 */
export const recurrenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekly"), weekdays: z.array(isoWeekdaySchema).min(1) }),
  z.object({
    type: z.literal("interval"),
    everyNDays: z.number().int().min(1),
    anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "anchorDate must be YYYY-MM-DD"),
  }),
]);

export type Recurrence = z.infer<typeof recurrenceSchema>;
