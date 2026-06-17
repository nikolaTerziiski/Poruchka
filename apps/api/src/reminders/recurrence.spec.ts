import { DateTime } from "luxon";
import { recurrenceMatchesDate } from "./recurrence";

const day = (iso: string) =>
  DateTime.fromISO(iso, { zone: "Europe/Sofia" }).startOf("day");

describe("recurrenceMatchesDate", () => {
  it("daily matches every day", () => {
    expect(recurrenceMatchesDate({ type: "daily" }, day("2026-06-17"))).toBe(true);
  });

  it("weekly matches the listed ISO weekdays", () => {
    // 2026-06-17 is a Wednesday (ISO weekday 3)
    expect(
      recurrenceMatchesDate({ type: "weekly", weekdays: [3] }, day("2026-06-17")),
    ).toBe(true);
    expect(
      recurrenceMatchesDate({ type: "weekly", weekdays: [1, 2] }, day("2026-06-17")),
    ).toBe(false);
  });

  it("interval matches every N days counted from the anchor", () => {
    const r = {
      type: "interval" as const,
      everyNDays: 3,
      anchorDate: "2026-06-15",
    };
    expect(recurrenceMatchesDate(r, day("2026-06-15"))).toBe(true); // +0
    expect(recurrenceMatchesDate(r, day("2026-06-18"))).toBe(true); // +3
    expect(recurrenceMatchesDate(r, day("2026-06-17"))).toBe(false); // +2
  });
});
