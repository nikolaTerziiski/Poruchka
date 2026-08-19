import { SchedulerService } from "./scheduler.service";

/**
 * Covers the dispatch fixes from the 2026-07-31 audit:
 *  - the atomic claim (no double-send, no clobbering a user's Sent/Snooze)
 *  - an unlinked assignee still escalating instead of looping forever
 *  - escalation repeating instead of dead-ending after one message
 */

type Run = Record<string, unknown>;

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    tenantId: "tenant-1",
    status: "PENDING",
    sentCount: 0,
    dueAt: new Date("2026-07-15T09:00:00.000Z"),
    tenant: {
      timezone: "Europe/Sofia",
      language: "bg",
      // Quiet hours 22:00-08:00; tests run at a local hour outside that window.
      quietHoursStart: 22,
      quietHoursEnd: 8,
      renudgeIntervalMin: 60,
      maxNudges: 3,
    },
    supplier: { name: "Metro" },
    assignedUser: { name: "Ivan", chatUserId: "555" },
    lines: [{ itemNameSnapshot: "Pork", quantitySnapshot: null, unitSnapshot: "kg", notesSnapshot: null }],
    orderRule: { cutoffTime: "11:00", recurrence: { type: "daily" }, escalationUserId: null, escalationUser: { chatUserId: "999" } },
    ...overrides,
  };
}

function harness(runs: Run[], claimCount = 1) {
  const updateMany = jest.fn().mockResolvedValue({ count: claimCount });
  const prisma = {
    orderRun: {
      findMany: jest.fn().mockResolvedValue(runs),
      updateMany,
    },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const channel = { channel: "telegram" as const, send: jest.fn().mockResolvedValue(undefined) };
  const orderRuns = { materializeToday: jest.fn().mockResolvedValue(undefined) };
  const service = new SchedulerService(prisma as never, orderRuns as never, channel as never);
  return { service, prisma, channel, updateMany };
}

// dispatch() is private; the cron entrypoint drives it.
const run = (s: SchedulerService) => (s as unknown as { dispatch(): Promise<void> }).dispatch();

describe("SchedulerService.dispatch", () => {
  it("claims the row before sending, and sends when the claim succeeds", async () => {
    const { service, channel, updateMany } = harness([makeRun()]);
    await run(service);

    expect(updateMany).toHaveBeenCalledTimes(1);
    const claim = updateMany.mock.calls[0][0];
    // The claim must be conditional on the state we read, so a concurrent user
    // action loses the race instead of being overwritten.
    expect(claim.where).toMatchObject({ id: "run-1", status: "PENDING" });
    expect(claim.where.nextNudgeAt).toBeDefined();
    expect(claim.data.sentCount).toBe(1);
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it("ships a Quantities button so a reminder with no amounts is still actionable", async () => {
    // The run below has quantitySnapshot: null — previously this reminder dead-ended
    // because the only path to set amounts was the web admin.
    const { service, channel } = harness([makeRun()]);
    await run(service);

    const payloads = channel.send.mock.calls[0][0].buttons.map((b: { payload: string }) => b.payload);
    expect(payloads).toContain("order:qty:run-1");
    expect(payloads).toContain("order:submit:run-1");
  });

  it("does NOT send when the claim matches no rows (user tapped Sent concurrently)", async () => {
    const { service, channel } = harness([makeRun()], 0);
    await run(service);

    // This is the "I already marked it Done and it kept nagging me" bug.
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("counts an unlinked assignee toward escalation instead of deferring forever", async () => {
    const unlinked = makeRun({ assignedUser: { name: "Ivan", chatUserId: null }, sentCount: 2 });
    const { service, channel, updateMany } = harness([unlinked]);
    await run(service);

    const data = updateMany.mock.calls[0][0].data;
    expect(data.sentCount).toBe(3); // advanced, not stuck at 2
    expect(data.status).toBe("ESCALATED");
    // No assignee message is possible, but the escalation contact is still told.
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.send.mock.calls[0][0].chatUserId).toBe("999");
  });

  it("escalates once the nudge cap is reached and notifies the escalation contact", async () => {
    const { service, channel, updateMany } = harness([makeRun({ sentCount: 2 })]);
    await run(service);

    expect(updateMany.mock.calls[0][0].data.status).toBe("ESCALATED");
    // assignee reminder + escalation notice
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send.mock.calls[1][0].chatUserId).toBe("999");
  });

  it("keeps re-notifying an already-ESCALATED run instead of going silent", async () => {
    const { service, channel, updateMany } = harness([makeRun({ status: "ESCALATED", sentCount: 9 })]);
    await run(service);

    const call = updateMany.mock.calls[0][0];
    expect(call.where.status).toBe("ESCALATED");
    expect(call.data.status).toBe("ESCALATED");
    expect(call.data.nextNudgeAt).toBeInstanceOf(Date); // not null — it comes back
    // Only the escalation contact is pinged; the assignee reminder is not resent.
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.send.mock.calls[0][0].chatUserId).toBe("999");
  });

  it("defers without sending during quiet hours", async () => {
    const quiet = makeRun({
      tenant: {
        timezone: "Europe/Sofia",
        language: "bg",
        quietHoursStart: 0,
        quietHoursEnd: 23, // quiet nearly all day, so any test clock lands inside
        renudgeIntervalMin: 60,
        maxNudges: 3,
      },
    });
    const { service, channel, updateMany } = harness([quiet]);
    await run(service);

    expect(channel.send).not.toHaveBeenCalled();
    const data = updateMany.mock.calls[0][0].data;
    expect(data.nextNudgeAt).toBeInstanceOf(Date);
    expect(data.sentCount).toBeUndefined(); // a defer must not consume a nudge
  });

  it("selects both PENDING and ESCALATED runs that are due", async () => {
    const { service, prisma } = harness([]);
    await run(service);

    const where = prisma.orderRun.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["PENDING", "ESCALATED"] });
  });
});

describe("SchedulerService.inQuietHours", () => {
  const quiet = (h: number, s: number, e: number) =>
    (new SchedulerService(null as never, null as never, null as never) as unknown as {
      inQuietHours(hour: number, start: number, end: number): boolean;
    }).inQuietHours(h, s, e);

  it("handles a window that wraps midnight", () => {
    expect(quiet(23, 22, 8)).toBe(true);
    expect(quiet(3, 22, 8)).toBe(true);
    expect(quiet(9, 22, 8)).toBe(false);
    expect(quiet(21, 22, 8)).toBe(false);
  });

  it("handles a same-day window", () => {
    expect(quiet(13, 12, 14)).toBe(true);
    expect(quiet(14, 12, 14)).toBe(false); // end is exclusive
    expect(quiet(11, 12, 14)).toBe(false);
  });

  it("treats start === end as no quiet window (guarded by settings validation)", () => {
    expect(quiet(3, 0, 0)).toBe(false);
  });
});
