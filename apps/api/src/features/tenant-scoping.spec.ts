import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ItemsController } from "./items.controller";
import { SchedulesController } from "./schedules.controller";
import { SuppliersController } from "./suppliers.controller";
import { PrismaService } from "../prisma/prisma.service";

describe("tenant-scoped resource mutations", () => {
  it("does not update a supplier from another tenant", async () => {
    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    const controller = new SuppliersController(prisma);

    await expect(controller.update("tenant-a", "supplier-b", { name: "Metro" })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: "supplier-b", tenantId: "tenant-a" },
    });
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });

  it("does not create an item for a supplier from another tenant", async () => {
    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      item: {
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const controller = new ItemsController(prisma);

    await expect(
      controller.create("tenant-a", {
        name: "Pork Meat",
        supplierId: "00000000-0000-0000-0000-000000000002",
        unit: "kg",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
      where: { id: "00000000-0000-0000-0000-000000000002", tenantId: "tenant-a" },
    });
    expect(prisma.item.create).not.toHaveBeenCalled();
  });

  it("does not create a schedule for an assignee from another tenant", async () => {
    const prisma = {
      item: {
        findFirst: jest.fn().mockResolvedValue({ id: "item-a" }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      schedule: {
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const controller = new SchedulesController(prisma);

    await expect(
      controller.create("tenant-a", {
        itemId: "00000000-0000-0000-0000-000000000001",
        assignedUserId: "00000000-0000-0000-0000-000000000003",
        reminderTimeOfDay: "09:00",
        recurrence: { type: "daily" },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "00000000-0000-0000-0000-000000000003", tenantId: "tenant-a" },
    });
    expect(prisma.schedule.create).not.toHaveBeenCalled();
  });
});
