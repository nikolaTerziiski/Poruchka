import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { CreateOrderRuleInput } from "@poruchka/shared";
import { PrismaService } from "../prisma/prisma.service";
import { OrderRulesController } from "./order-rules.controller";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  supplier: "00000000-0000-0000-0000-000000000002",
  otherSupplier: "00000000-0000-0000-0000-000000000003",
  assignee: "00000000-0000-0000-0000-000000000004",
  escalation: "00000000-0000-0000-0000-000000000005",
  pork: "00000000-0000-0000-0000-000000000006",
  tomatoes: "00000000-0000-0000-0000-000000000007",
  rule: "00000000-0000-0000-0000-000000000008",
};

function createPrismaMock() {
  return {
    supplier: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    item: {
      findMany: jest.fn(),
    },
    orderRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    orderRun: {
      deleteMany: jest.fn(),
    },
  };
}

function controllerFor(prisma: ReturnType<typeof createPrismaMock>) {
  return new OrderRulesController(prisma as unknown as PrismaService);
}

function mockValidRefs(
  prisma: ReturnType<typeof createPrismaMock>,
  itemIds: string[],
  supplierId = ids.supplier,
) {
  prisma.supplier.findFirst.mockResolvedValue({ id: supplierId });
  prisma.user.findFirst.mockResolvedValue({ id: ids.assignee });
  prisma.item.findMany.mockResolvedValue(itemIds.map((id) => ({ id, supplierId })));
}

describe("OrderRulesController grouped order behavior", () => {
  it("lists only non-archived order rules", async () => {
    const prisma = createPrismaMock();
    prisma.orderRule.findMany.mockResolvedValue([]);
    const controller = controllerFor(prisma);

    await expect(controller.list(ids.tenant)).resolves.toEqual([]);

    expect(prisma.orderRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: ids.tenant, archivedAt: null },
      }),
    );
  });

  it("rejects an order rule supplier from another tenant", async () => {
    const prisma = createPrismaMock();
    prisma.supplier.findFirst.mockResolvedValue(null);
    const controller = controllerFor(prisma);

    await expect(
      controller.create(ids.tenant, {
        supplierId: ids.otherSupplier,
        assignedUserId: ids.assignee,
        reminderTimeOfDay: "09:00",
        recurrence: { type: "daily" },
        lines: [{ itemId: ids.pork }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: ids.otherSupplier, tenantId: ids.tenant },
      select: { id: true },
    });
    expect(prisma.orderRule.create).not.toHaveBeenCalled();
  });

  it("rejects an order rule assignee from another tenant", async () => {
    const prisma = createPrismaMock();
    prisma.supplier.findFirst.mockResolvedValue({ id: ids.supplier });
    prisma.user.findFirst.mockResolvedValue(null);
    const controller = controllerFor(prisma);

    await expect(
      controller.create(ids.tenant, {
        supplierId: ids.supplier,
        assignedUserId: ids.assignee,
        reminderTimeOfDay: "09:00",
        recurrence: { type: "daily" },
        lines: [{ itemId: ids.pork }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: ids.assignee, tenantId: ids.tenant },
      select: { id: true },
    });
    expect(prisma.orderRule.create).not.toHaveBeenCalled();
  });

  it("rejects an escalation user from another tenant", async () => {
    const prisma = createPrismaMock();
    prisma.supplier.findFirst.mockResolvedValue({ id: ids.supplier });
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: ids.assignee })
      .mockResolvedValueOnce(null);
    const controller = controllerFor(prisma);

    await expect(
      controller.create(ids.tenant, {
        supplierId: ids.supplier,
        assignedUserId: ids.assignee,
        escalationUserId: ids.escalation,
        reminderTimeOfDay: "09:00",
        recurrence: { type: "daily" },
        lines: [{ itemId: ids.pork }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.findFirst).toHaveBeenLastCalledWith({
      where: { id: ids.escalation, tenantId: ids.tenant },
      select: { id: true },
    });
    expect(prisma.orderRule.create).not.toHaveBeenCalled();
  });

  it("rejects an order rule item from another tenant", async () => {
    const prisma = createPrismaMock();
    prisma.supplier.findFirst.mockResolvedValue({ id: ids.supplier });
    prisma.user.findFirst.mockResolvedValue({ id: ids.assignee });
    prisma.item.findMany.mockResolvedValue([]);
    const controller = controllerFor(prisma);

    await expect(
      controller.create(ids.tenant, {
        supplierId: ids.supplier,
        assignedUserId: ids.assignee,
        reminderTimeOfDay: "09:00",
        recurrence: { type: "daily" },
        lines: [{ itemId: ids.pork }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { id: { in: [ids.pork] }, tenantId: ids.tenant },
      select: { id: true, supplierId: true },
    });
    expect(prisma.orderRule.create).not.toHaveBeenCalled();
  });

  it("rejects order-rule lines for items from another supplier", async () => {
    const prisma = createPrismaMock();
    prisma.supplier.findFirst.mockResolvedValue({ id: ids.supplier });
    prisma.user.findFirst.mockResolvedValue({ id: ids.assignee });
    prisma.item.findMany.mockResolvedValue([{ id: ids.pork, supplierId: ids.otherSupplier }]);
    const controller = controllerFor(prisma);

    await expect(
      controller.create(ids.tenant, {
        supplierId: ids.supplier,
        assignedUserId: ids.assignee,
        reminderTimeOfDay: "09:00",
        recurrence: { type: "daily" },
        lines: [{ itemId: ids.pork }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.orderRule.create).not.toHaveBeenCalled();
  });

  it("rejects updated order-rule lines for items from another supplier", async () => {
    const prisma = createPrismaMock();
    prisma.orderRule.findFirst.mockResolvedValue({ id: ids.rule, supplierId: ids.supplier });
    prisma.item.findMany.mockResolvedValue([{ id: ids.pork, supplierId: ids.otherSupplier }]);
    const controller = controllerFor(prisma);

    await expect(
      controller.update(ids.tenant, ids.rule, {
        lines: [{ itemId: ids.pork }],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.orderRule.update).not.toHaveBeenCalled();
  });

  it("creates a one-line order rule", async () => {
    const prisma = createPrismaMock();
    mockValidRefs(prisma, [ids.pork]);
    prisma.orderRule.create.mockResolvedValue({ id: ids.rule });
    const controller = controllerFor(prisma);

    const dto: CreateOrderRuleInput = {
      supplierId: ids.supplier,
      assignedUserId: ids.assignee,
      reminderTimeOfDay: "09:00",
      recurrence: { type: "weekly", weekdays: [3] },
      cutoffTime: "12:00",
      expectedDeliveryOffsetDays: 2,
      lines: [{ itemId: ids.pork }],
    };

    await expect(controller.create(ids.tenant, dto)).resolves.toEqual({ id: ids.rule });

    expect(prisma.orderRule.create).toHaveBeenCalledWith({
      data: {
        tenantId: ids.tenant,
        supplierId: ids.supplier,
        assignedUserId: ids.assignee,
        escalationUserId: null,
        reminderTimeOfDay: "09:00",
        recurrence: { type: "weekly", weekdays: [3] },
        cutoffTime: "12:00",
        expectedDeliveryOffsetDays: 2,
        lines: {
          create: [
            {
              itemId: ids.pork,
              defaultQuantity: null,
              unit: null,
              notes: null,
              sortOrder: 0,
            },
          ],
        },
      },
      include: expect.any(Object),
    });
  });

  it("creates a multi-line order rule", async () => {
    const prisma = createPrismaMock();
    mockValidRefs(prisma, [ids.pork, ids.tomatoes]);
    prisma.orderRule.create.mockResolvedValue({ id: ids.rule });
    const controller = controllerFor(prisma);

    const dto: CreateOrderRuleInput = {
      supplierId: ids.supplier,
      assignedUserId: ids.assignee,
      escalationUserId: ids.escalation,
      reminderTimeOfDay: "10:30",
      recurrence: { type: "interval", everyNDays: 3, anchorDate: "2026-07-01" },
      lines: [
        { itemId: ids.pork, defaultQuantity: 12, unit: "kg", notes: "trimmed", sortOrder: 4 },
        { itemId: ids.tomatoes, defaultQuantity: 6, unit: "kg" },
      ],
    };

    await controller.create(ids.tenant, dto);

    expect(prisma.orderRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          escalationUserId: ids.escalation,
          lines: {
            create: [
              {
                itemId: ids.pork,
                defaultQuantity: 12,
                unit: "kg",
                notes: "trimmed",
                sortOrder: 4,
              },
              {
                itemId: ids.tomatoes,
                defaultQuantity: 6,
                unit: "kg",
                notes: null,
                sortOrder: 1,
              },
            ],
          },
        }),
      }),
    );
  });

  it("creates a multi-line order rule with mixed optional quantity hints", async () => {
    const prisma = createPrismaMock();
    mockValidRefs(prisma, [ids.pork, ids.tomatoes]);
    prisma.orderRule.create.mockResolvedValue({ id: ids.rule });
    const controller = controllerFor(prisma);

    const dto: CreateOrderRuleInput = {
      supplierId: ids.supplier,
      assignedUserId: ids.assignee,
      reminderTimeOfDay: "10:30",
      recurrence: { type: "weekly", weekdays: [1, 3, 5] },
      lines: [
        { itemId: ids.pork },
        { itemId: ids.tomatoes, defaultQuantity: 6, unit: "kg" },
      ],
    };

    await controller.create(ids.tenant, dto);

    expect(prisma.orderRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: [
              {
                itemId: ids.pork,
                defaultQuantity: null,
                unit: null,
                notes: null,
                sortOrder: 0,
              },
              {
                itemId: ids.tomatoes,
                defaultQuantity: 6,
                unit: "kg",
                notes: null,
                sortOrder: 1,
              },
            ],
          },
        }),
      }),
    );
  });

  it("updates a one-line order rule by replacing its basket", async () => {
    const prisma = createPrismaMock();
    prisma.orderRule.findFirst.mockResolvedValue({ id: ids.rule, supplierId: ids.supplier });
    prisma.item.findMany.mockResolvedValue([{ id: ids.pork, supplierId: ids.supplier }]);
    prisma.orderRule.update.mockResolvedValue({ id: ids.rule });
    const controller = controllerFor(prisma);

    await expect(
      controller.update(ids.tenant, ids.rule, {
        lines: [{ itemId: ids.pork }],
      }),
    ).resolves.toEqual({ id: ids.rule });

    expect(prisma.orderRule.findFirst).toHaveBeenCalledWith({
      where: { id: ids.rule, tenantId: ids.tenant, archivedAt: null },
      select: { id: true, supplierId: true },
    });
    expect(prisma.orderRule.update).toHaveBeenCalledWith({
      where: { id: ids.rule },
      data: {
        lines: {
          deleteMany: {},
          create: [
            {
              itemId: ids.pork,
              defaultQuantity: null,
              unit: null,
              notes: null,
              sortOrder: 0,
            },
          ],
        },
      },
      include: expect.any(Object),
    });
  });

  it("updates a multi-line order rule by replacing its basket", async () => {
    const prisma = createPrismaMock();
    prisma.orderRule.findFirst.mockResolvedValue({ id: ids.rule, supplierId: ids.supplier });
    prisma.supplier.findFirst.mockResolvedValue({ id: ids.otherSupplier });
    prisma.user.findFirst.mockResolvedValue({ id: ids.assignee });
    prisma.item.findMany.mockResolvedValue([
      { id: ids.pork, supplierId: ids.otherSupplier },
      { id: ids.tomatoes, supplierId: ids.otherSupplier },
    ]);
    prisma.orderRule.update.mockResolvedValue({ id: ids.rule });
    const controller = controllerFor(prisma);

    await controller.update(ids.tenant, ids.rule, {
      supplierId: ids.otherSupplier,
      assignedUserId: ids.assignee,
      reminderTimeOfDay: "11:15",
      recurrence: { type: "daily" },
      lines: [
        { itemId: ids.pork, defaultQuantity: 10, unit: "kg", notes: "lean" },
        { itemId: ids.tomatoes, defaultQuantity: 5, sortOrder: 9 },
      ],
    });

    expect(prisma.orderRule.update).toHaveBeenCalledWith({
      where: { id: ids.rule },
      data: {
        supplier: { connect: { id: ids.otherSupplier } },
        assignedUser: { connect: { id: ids.assignee } },
        reminderTimeOfDay: "11:15",
        recurrence: { type: "daily" },
        lines: {
          deleteMany: {},
          create: [
            {
              itemId: ids.pork,
              defaultQuantity: 10,
              unit: "kg",
              notes: "lean",
              sortOrder: 0,
            },
            {
              itemId: ids.tomatoes,
              defaultQuantity: 5,
              unit: null,
              notes: null,
              sortOrder: 9,
            },
          ],
        },
      },
      include: expect.any(Object),
    });
  });

  it("archives an order rule instead of deleting its existing runs", async () => {
    jest.useFakeTimers();
    const archivedAt = new Date("2026-07-01T09:00:00.000Z");
    jest.setSystemTime(archivedAt);

    try {
      const prisma = createPrismaMock();
      prisma.orderRule.findFirst.mockResolvedValue({ id: ids.rule });
      prisma.orderRule.update.mockResolvedValue({ id: ids.rule });
      const controller = controllerFor(prisma);

      await expect(controller.remove(ids.tenant, ids.rule)).resolves.toEqual({ ok: true });

      expect(prisma.orderRule.findFirst).toHaveBeenCalledWith({
        where: { id: ids.rule, tenantId: ids.tenant, archivedAt: null },
        select: { id: true },
      });
      expect(prisma.orderRule.update).toHaveBeenCalledWith({
        where: { id: ids.rule },
        data: { active: false, archivedAt },
      });
      expect(prisma.orderRule.delete).not.toHaveBeenCalled();
      expect(prisma.orderRun.deleteMany).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not archive another tenant's order rule", async () => {
    const prisma = createPrismaMock();
    prisma.orderRule.findFirst.mockResolvedValue(null);
    const controller = controllerFor(prisma);

    await expect(controller.remove(ids.tenant, ids.rule)).rejects.toThrow(NotFoundException);

    expect(prisma.orderRule.update).not.toHaveBeenCalled();
    expect(prisma.orderRule.delete).not.toHaveBeenCalled();
  });
});
