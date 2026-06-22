import { PrismaService } from "../../prisma/prisma.service";
import { TelegramReminderConfirmationService } from "./telegram-reminder-confirmation.service";

function pendingReminder() {
  return {
    id: "reminder-a",
    tenantId: "tenant-a",
    status: "PENDING",
    tenant: { language: "en" },
    schedule: { assignedUserId: "assigned-user" },
  };
}

describe("TelegramReminderConfirmationService", () => {
  let prisma: PrismaService;
  let service: TelegramReminderConfirmationService;
  let reminderFindUnique: jest.Mock;
  let reminderUpdateMany: jest.Mock;
  let userFindFirst: jest.Mock;

  beforeEach(() => {
    reminderFindUnique = jest.fn().mockResolvedValue(pendingReminder());
    reminderUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    userFindFirst = jest.fn().mockResolvedValue({
      id: "assigned-user",
      tenantId: "tenant-a",
      role: "STAFF",
    });
    prisma = {
      reminderInstance: {
        findUnique: reminderFindUnique,
        updateMany: reminderUpdateMany,
      },
      user: {
        findFirst: userFindFirst,
      },
    } as unknown as PrismaService;
    service = new TelegramReminderConfirmationService(prisma);
  });

  it("confirms a reminder for the assigned Telegram user", async () => {
    await expect(service.confirm("reminder-a", "telegram-1")).resolves.toEqual({
      outcome: "confirmed",
      language: "en",
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", chatChannel: "TELEGRAM", chatUserId: "telegram-1" },
      select: { id: true, tenantId: true, role: true },
    });
    expect(prisma.reminderInstance.updateMany).toHaveBeenCalledWith({
      where: { id: "reminder-a", tenantId: "tenant-a", status: { in: ["PENDING", "ESCALATED"] } },
      data: {
        status: "CONFIRMED",
        confirmedAt: expect.any(Date),
        confirmedByUserId: "assigned-user",
        nextNudgeAt: null,
      },
    });
  });

  it.each(["OWNER", "MANAGER"] as const)(
    "allows %s users in the same tenant to confirm as an override",
    async (role) => {
      userFindFirst.mockResolvedValue({
        id: `${role.toLowerCase()}-user`,
        tenantId: "tenant-a",
        role,
      });

      await expect(service.confirm("reminder-a", "telegram-override")).resolves.toEqual({
        outcome: "confirmed",
        language: "en",
      });
      expect(prisma.reminderInstance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ confirmedByUserId: `${role.toLowerCase()}-user` }),
        }),
      );
    },
  );

  it("rejects an unrelated staff Telegram user in the same tenant", async () => {
    userFindFirst.mockResolvedValue({
      id: "other-staff",
      tenantId: "tenant-a",
      role: "STAFF",
    });

    await expect(service.confirm("reminder-a", "telegram-2")).resolves.toEqual({
      outcome: "unauthorized",
      language: "en",
    });
    expect(prisma.reminderInstance.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a Telegram user that is not linked in the reminder tenant", async () => {
    userFindFirst.mockResolvedValue(null);

    await expect(service.confirm("reminder-a", "telegram-other-tenant")).resolves.toEqual({
      outcome: "unauthorized",
      language: "en",
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        chatChannel: "TELEGRAM",
        chatUserId: "telegram-other-tenant",
      },
      select: { id: true, tenantId: true, role: true },
    });
    expect(prisma.reminderInstance.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a mismatched tenant actor even if one is returned by the database", async () => {
    userFindFirst.mockResolvedValue({
      id: "assigned-user",
      tenantId: "tenant-b",
      role: "STAFF",
    });

    await expect(service.confirm("reminder-a", "telegram-cross-tenant")).resolves.toEqual({
      outcome: "unauthorized",
      language: "en",
    });
    expect(prisma.reminderInstance.updateMany).not.toHaveBeenCalled();
  });

  it("treats duplicate confirmation callbacks as idempotent", async () => {
    reminderFindUnique.mockResolvedValue({
      ...pendingReminder(),
      status: "CONFIRMED",
    });

    await expect(service.confirm("reminder-a", "telegram-1")).resolves.toEqual({
      outcome: "already_confirmed",
      language: "en",
    });
    expect(prisma.reminderInstance.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to confirm a cancelled reminder", async () => {
    reminderFindUnique.mockResolvedValue({
      ...pendingReminder(),
      status: "CANCELLED",
    });

    await expect(service.confirm("reminder-a", "telegram-1")).resolves.toEqual({
      outcome: "cancelled",
      language: "en",
    });
    expect(prisma.reminderInstance.updateMany).not.toHaveBeenCalled();
  });

  it("treats a concurrent duplicate update as idempotent", async () => {
    reminderUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.confirm("reminder-a", "telegram-1")).resolves.toEqual({
      outcome: "already_confirmed",
      language: "en",
    });
  });

  it("returns not_found for a missing reminder", async () => {
    reminderFindUnique.mockResolvedValue(null);

    await expect(service.confirm("missing-reminder", "telegram-1")).resolves.toEqual({
      outcome: "not_found",
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.reminderInstance.updateMany).not.toHaveBeenCalled();
  });
});
