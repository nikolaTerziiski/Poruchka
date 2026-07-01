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
