import { PrismaService } from "../prisma/prisma.service";
import { OrdersController } from "./orders.controller";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  rule: "00000000-0000-0000-0000-000000000002",
  run: "00000000-0000-0000-0000-000000000003",
};

function createPrismaMock() {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ id: ids.tenant, timezone: "Europe/Sofia" }),
    },
    orderRule: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    orderRun: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function controllerFor(prisma: ReturnType<typeof createPrismaMock>) {
  return new OrdersController(prisma as unknown as PrismaService);
}

function dailyRule(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.rule,
    reminderTimeOfDay: "09:00",
    recurrence: { type: "daily" },
    cutoffTime: "14:00",
    supplier: { name: "Metro" },
    assignedUser: { name: "Georgi" },
    lines: [
      {
        defaultQuantity: 20,
        unit: null,
        item: { name: "Pork Meat", unit: "kg" },
      },
    ],
    ...overrides,
  };
}

function submittedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.run,
    orderRuleId: ids.rule,
    dueDate: new Date("2026-07-01T00:00:00Z"),
    dueAt: new Date("2026-07-01T06:00:00Z"), // 09:00 Europe/Sofia
    status: "SUBMITTED",
    expectedDeliveryDate: new Date("2026-07-03T00:00:00Z"),
    sentCount: 2,
    lastSentAt: new Date("2026-07-01T07:00:00Z"),
    nextNudgeAt: null,
    postponedCount: 1,
    postponedUntil: new Date("2026-07-01T09:00:00Z"),
    submittedAt: new Date("2026-07-01T07:32:00Z"),
    supplier: { name: "Metro" },
    assignedUser: { name: "Georgi" },
    submittedByUser: { name: "Elena" },
    orderRule: { cutoffTime: "14:00" },
    lines: [
      { itemNameSnapshot: "Pork Meat", quantitySnapshot: 20, unitSnapshot: "kg" },
    ],
    ...overrides,
  };
}

describe("OrdersController calendar read model", () => {
  it("exposes run timeline fields (nudges, postpone, submitted-by) on occurrences", async () => {
    const prisma = createPrismaMock();
    prisma.orderRun.findMany.mockResolvedValue([submittedRun()]);
    const controller = controllerFor(prisma);

    const out = await controller.list(ids.tenant, "2026-07-01", "2026-07-01");

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      date: "2026-07-01",
      orderRuleId: ids.rule,
      supplier: "Metro",
      assignee: "Georgi",
      time: "09:00",
      status: "submitted",
      cutoffTime: "14:00",
      expectedDeliveryDate: "2026-07-03",
      sentCount: 2,
      lastSentAt: "2026-07-01T07:00:00.000Z",
      nextNudgeAt: null,
      postponedCount: 1,
      postponedUntil: "2026-07-01T09:00:00.000Z",
      submittedAt: "2026-07-01T07:32:00.000Z",
      submittedBy: "Elena",
      lines: [{ item: "Pork Meat", quantity: 20, unit: "kg" }],
    });
  });

  it("derives pending occurrences from rules with a zeroed timeline", async () => {
    const prisma = createPrismaMock();
    prisma.orderRule.findMany.mockResolvedValue([dailyRule()]);
    const controller = controllerFor(prisma);

    const out = await controller.list(ids.tenant, "2026-07-01", "2026-07-02");

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      date: "2026-07-01",
      status: "pending",
      time: "09:00",
      cutoffTime: "14:00",
      sentCount: 0,
      lastSentAt: null,
      nextNudgeAt: null,
      postponedCount: 0,
      postponedUntil: null,
      submittedAt: null,
      submittedBy: null,
      lines: [{ item: "Pork Meat", quantity: 20, unit: "kg" }],
    });
  });

  it("suppresses the rule-derived entry on days where a real run exists", async () => {
    const prisma = createPrismaMock();
    prisma.orderRule.findMany.mockResolvedValue([dailyRule()]);
    prisma.orderRun.findMany.mockResolvedValue([submittedRun()]);
    const controller = controllerFor(prisma);

    const out = await controller.list(ids.tenant, "2026-07-01", "2026-07-02");

    expect(out).toHaveLength(2);
    expect(out.map((o) => [o.date, o.status])).toEqual([
      ["2026-07-01", "submitted"],
      ["2026-07-02", "pending"],
    ]);
  });
});
