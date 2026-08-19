import { DateTime } from "luxon";
import { NotificationChannel } from "../channels/notification-channel.port";
import { PrismaService } from "../prisma/prisma.service";
import { SchedulerService } from "./scheduler.service";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  rule: "00000000-0000-0000-0000-000000000002",
  supplier: "00000000-0000-0000-0000-000000000003",
  assignee: "00000000-0000-0000-0000-000000000004",
  pork: "00000000-0000-0000-0000-000000000005",
  tomatoes: "00000000-0000-0000-0000-000000000006",
};

function createPrismaMock() {
  return {
    tenant: {
      findMany: jest.fn(),
    },
    orderRun: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
}

function createService(prisma: ReturnType<typeof createPrismaMock>) {
  const channel: NotificationChannel = { channel: "telegram", send: jest.fn() };
  return new SchedulerService(prisma as unknown as PrismaService, channel);
}

function activeRule() {
  return {
    id: ids.rule,
    supplierId: ids.supplier,
    assignedUserId: ids.assignee,
    reminderTimeOfDay: "09:30",
    recurrence: { type: "daily" },
    expectedDeliveryOffsetDays: 2,
    lines: [
      {
        itemId: ids.pork,
        defaultQuantity: 12,
        unit: "kg",
        notes: "trimmed",
        sortOrder: 0,
        item: { name: "Pork Meat", unit: "kg", notes: "lean" },
      },
      {
        itemId: ids.tomatoes,
        defaultQuantity: 6,
        unit: null,
        notes: null,
        sortOrder: null,
        item: { name: "Tomatoes", unit: "kg", notes: "ripe" },
      },
    ],
  };
}

describe("SchedulerService grouped order materialization", () => {
  beforeEach(() => {
    const fixedNow = DateTime.fromISO("2026-07-01T10:00:00.000", { zone: "Europe/Sofia" });
    if (!fixedNow.isValid) throw new Error("Invalid fixed scheduler test date");
    jest
      .spyOn(DateTime, "now")
      .mockReturnValue(fixedNow as DateTime<true>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("materializes only active non-archived order rules", async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findMany.mockResolvedValue([
      { id: ids.tenant, timezone: "Europe/Sofia", orderRules: [] },
    ]);
    prisma.orderRun.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await service.tick();

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      include: {
        orderRules: {
          where: { active: true, archivedAt: null },
          include: { lines: { include: { item: true }, orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    expect(prisma.orderRun.create).not.toHaveBeenCalled();
  });

  it("does not duplicate order runs across repeated ticks", async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findMany.mockResolvedValue([
      { id: ids.tenant, timezone: "Europe/Sofia", orderRules: [activeRule()] },
    ]);
    prisma.orderRun.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "run-existing" });
    prisma.orderRun.create.mockResolvedValue({ id: "run-new" });
    prisma.orderRun.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await service.tick();
    await service.tick();

    const dueDate = new Date("2026-07-01T00:00:00.000Z");
    expect(prisma.orderRun.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.orderRun.findUnique).toHaveBeenCalledWith({
      where: { orderRuleId_dueDate: { orderRuleId: ids.rule, dueDate } },
      select: { id: true },
    });
    expect(prisma.orderRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.orderRun.create).toHaveBeenCalledWith({
      data: {
        tenantId: ids.tenant,
        orderRuleId: ids.rule,
        supplierId: ids.supplier,
        assignedUserId: ids.assignee,
        dueDate,
        dueAt: new Date("2026-07-01T06:30:00.000Z"),
        expectedDeliveryDate: new Date("2026-07-03T00:00:00.000Z"),
        status: "PENDING",
        nextNudgeAt: new Date("2026-07-01T06:30:00.000Z"),
        lines: {
          create: [
            {
              itemId: ids.pork,
              itemNameSnapshot: "Pork Meat",
              quantitySnapshot: 12,
              unitSnapshot: "kg",
              notesSnapshot: "trimmed",
              sortOrder: 0,
            },
            {
              itemId: ids.tomatoes,
              itemNameSnapshot: "Tomatoes",
              quantitySnapshot: 6,
              unitSnapshot: "kg",
              notesSnapshot: "ripe",
              sortOrder: 1,
            },
          ],
        },
      },
    });
  });
});

describe("SchedulerService REMINDER_TEST_FAST mode", () => {
  const fixedNow = DateTime.fromISO("2026-07-01T10:00:00.000", { zone: "Europe/Sofia" });

  function pendingRun(overrides: Record<string, unknown> = {}) {
    return {
      id: "run-1",
      sentCount: 0,
      tenant: {
        id: ids.tenant,
        timezone: "Europe/Sofia",
        language: "bg",
        // Quiet hours covering "now" (10:00): normally nothing would send.
        quietHoursStart: 9,
        quietHoursEnd: 12,
        renudgeIntervalMin: 60,
        maxNudges: 5,
      },
      supplier: { name: "Metro" },
      assignedUser: { id: ids.assignee, name: "Georgi", chatUserId: "555001" },
      orderRule: { cutoffTime: null },
      lines: [
        { itemNameSnapshot: "Pork Meat", quantitySnapshot: 12, unitSnapshot: "kg", notesSnapshot: null, sortOrder: 0 },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.spyOn(DateTime, "now").mockReturnValue(fixedNow as DateTime<true>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.REMINDER_TEST_FAST;
  });

  it("materializes runs that send immediately instead of waiting for the reminder time", async () => {
    process.env.REMINDER_TEST_FAST = "1";
    const prisma = createPrismaMock();
    prisma.tenant.findMany.mockResolvedValue([
      { id: ids.tenant, timezone: "Europe/Sofia", orderRules: [activeRule()] },
    ]);
    prisma.orderRun.findUnique.mockResolvedValue(null);
    prisma.orderRun.create.mockResolvedValue({ id: "run-new" });
    prisma.orderRun.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    await service.tick();

    const created = prisma.orderRun.create.mock.calls[0][0].data;
    // Rule time is 09:30 (already passed here, but the point holds for any
    // future time): fast mode arms the nudge for NOW, not the rule's dueAt.
    expect(created.nextNudgeAt).toEqual(fixedNow.toJSDate());
  });

  it("sends during quiet hours and re-arms the nudge one minute out", async () => {
    process.env.REMINDER_TEST_FAST = "1";
    const prisma = createPrismaMock();
    prisma.tenant.findMany.mockResolvedValue([]);
    prisma.orderRun.findMany.mockResolvedValue([pendingRun()]);
    prisma.orderRun.update.mockResolvedValue({});
    const channel: NotificationChannel = { channel: "telegram", send: jest.fn() };
    const service = new SchedulerService(prisma as unknown as PrismaService, channel);

    await service.tick();

    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(prisma.orderRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        sentCount: 1,
        nextNudgeAt: fixedNow.plus({ minutes: 1 }).toJSDate(),
      }),
    });
  });

  it("never activates in production even when the flag is set", async () => {
    process.env.REMINDER_TEST_FAST = "1";
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const prisma = createPrismaMock();
      prisma.tenant.findMany.mockResolvedValue([]);
      prisma.orderRun.findMany.mockResolvedValue([pendingRun()]);
      prisma.orderRun.update.mockResolvedValue({});
      const channel: NotificationChannel = { channel: "telegram", send: jest.fn() };
      const service = new SchedulerService(prisma as unknown as PrismaService, channel);

      await service.tick();

      // Quiet hours apply again: deferred, nothing sent.
      expect(channel.send).not.toHaveBeenCalled();
      expect(prisma.orderRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: { nextNudgeAt: fixedNow.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toJSDate() },
      });
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});

// Carried over from the 2026-07-31 audit: the quiet-hours window is pure logic
// and is easy to get wrong at the midnight wrap, so it gets its own unit tests.
describe("SchedulerService.inQuietHours", () => {
  const quiet = (h: number, s: number, e: number) =>
    (
      new SchedulerService(null as never, null as never) as unknown as {
        inQuietHours(hour: number, start: number, end: number): boolean;
      }
    ).inQuietHours(h, s, e);

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
