import { TelegramOrderActionService } from "./telegram-order-action.service";
import { PrismaService } from "../../prisma/prisma.service";

function pendingRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-a",
    tenantId: "tenant-a",
    status: "PENDING",
    assignedUserId: "assigned-user",
    dueAt: new Date("2026-06-22T06:00:00.000Z"),
    tenant: { language: "en", timezone: "Europe/Sofia" },
    orderRule: { escalationUserId: null },
    ...overrides,
  };
}

describe("TelegramOrderActionService", () => {
  let prisma: PrismaService;
  let service: TelegramOrderActionService;
  let runFindUnique: jest.Mock;
  let runUpdateMany: jest.Mock;
  let userFindFirst: jest.Mock;

  beforeEach(() => {
    runFindUnique = jest.fn().mockResolvedValue(pendingRun());
    runUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    userFindFirst = jest
      .fn()
      .mockResolvedValue({ id: "assigned-user", tenantId: "tenant-a", role: "STAFF" });
    prisma = {
      orderRun: { findUnique: runFindUnique, updateMany: runUpdateMany },
      user: { findFirst: userFindFirst },
    } as unknown as PrismaService;
    service = new TelegramOrderActionService(prisma);
  });

  describe("submit", () => {
    it("submits the order for the assigned user", async () => {
      await expect(service.submit("run-a", "tg-1")).resolves.toEqual({
        outcome: "submitted",
        language: "en",
      });
      expect(runUpdateMany).toHaveBeenCalledWith({
        where: { id: "run-a", tenantId: "tenant-a", status: { in: ["PENDING", "ESCALATED"] } },
        data: {
          status: "SUBMITTED",
          submittedAt: expect.any(Date),
          submittedByUserId: "assigned-user",
          nextNudgeAt: null,
        },
      });
    });

    it.each(["OWNER", "MANAGER"] as const)("allows %s users to submit as an override", async (role) => {
      userFindFirst.mockResolvedValue({ id: `${role}-user`, tenantId: "tenant-a", role });
      await expect(service.submit("run-a", "tg-override")).resolves.toEqual({
        outcome: "submitted",
        language: "en",
      });
    });

    it("allows the rule's escalation target to submit", async () => {
      runFindUnique.mockResolvedValue(pendingRun({ orderRule: { escalationUserId: "boss" } }));
      userFindFirst.mockResolvedValue({ id: "boss", tenantId: "tenant-a", role: "STAFF" });
      await expect(service.submit("run-a", "tg-boss")).resolves.toEqual({
        outcome: "submitted",
        language: "en",
      });
    });

    it("rejects an unrelated staff member", async () => {
      userFindFirst.mockResolvedValue({ id: "other", tenantId: "tenant-a", role: "STAFF" });
      await expect(service.submit("run-a", "tg-2")).resolves.toEqual({
        outcome: "unauthorized",
        language: "en",
      });
      expect(runUpdateMany).not.toHaveBeenCalled();
    });

    it("rejects a telegram user not linked in the tenant", async () => {
      userFindFirst.mockResolvedValue(null);
      await expect(service.submit("run-a", "tg-unknown")).resolves.toEqual({
        outcome: "unauthorized",
        language: "en",
      });
    });

    it("rejects a cross-tenant actor", async () => {
      userFindFirst.mockResolvedValue({ id: "assigned-user", tenantId: "tenant-b", role: "STAFF" });
      await expect(service.submit("run-a", "tg-x")).resolves.toEqual({
        outcome: "unauthorized",
        language: "en",
      });
      expect(runUpdateMany).not.toHaveBeenCalled();
    });

    it("is idempotent for an already-submitted order", async () => {
      runFindUnique.mockResolvedValue(pendingRun({ status: "SUBMITTED" }));
      await expect(service.submit("run-a", "tg-1")).resolves.toEqual({
        outcome: "already_submitted",
        language: "en",
      });
      expect(runUpdateMany).not.toHaveBeenCalled();
    });

    it("refuses to submit a skipped order", async () => {
      runFindUnique.mockResolvedValue(pendingRun({ status: "SKIPPED" }));
      await expect(service.submit("run-a", "tg-1")).resolves.toEqual({
        outcome: "skipped",
        language: "en",
      });
      expect(runUpdateMany).not.toHaveBeenCalled();
    });

    it("treats a concurrent duplicate update as already submitted", async () => {
      runUpdateMany.mockResolvedValue({ count: 0 });
      await expect(service.submit("run-a", "tg-1")).resolves.toEqual({
        outcome: "already_submitted",
        language: "en",
      });
    });

    it("returns not_found for a missing run", async () => {
      runFindUnique.mockResolvedValue(null);
      await expect(service.submit("missing", "tg-1")).resolves.toEqual({ outcome: "not_found" });
      expect(userFindFirst).not.toHaveBeenCalled();
    });
  });

  describe("postpone", () => {
    it("postpones a live order and records the snooze", async () => {
      await expect(service.postpone("run-a", "tg-1", "tomorrow")).resolves.toEqual({
        outcome: "postponed",
        language: "en",
        choice: "tomorrow",
      });
      expect(runUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "run-a", tenantId: "tenant-a", status: { in: ["PENDING", "ESCALATED"] } },
          data: expect.objectContaining({
            status: "PENDING",
            sentCount: 0,
            nextNudgeAt: expect.any(Date),
            postponedUntil: expect.any(Date),
            lastPostponedAt: expect.any(Date),
            postponedCount: { increment: 1 },
          }),
        }),
      );
    });

    it("refuses to postpone a skipped order", async () => {
      runFindUnique.mockResolvedValue(pendingRun({ status: "SKIPPED" }));
      await expect(service.postpone("run-a", "tg-1", "1h")).resolves.toEqual({
        outcome: "skipped",
        language: "en",
      });
      expect(runUpdateMany).not.toHaveBeenCalled();
    });

    it("rejects an unauthorized user", async () => {
      userFindFirst.mockResolvedValue(null);
      await expect(service.postpone("run-a", "tg-unknown", "1h")).resolves.toEqual({
        outcome: "unauthorized",
        language: "en",
      });
    });
  });
});
