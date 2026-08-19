import { updateMeSchema } from "@poruchka/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MeController } from "./me.controller";

const userId = "00000000-0000-0000-0000-000000000010";

function createPrismaMock() {
  return {
    user: {
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };
}

function controllerFor(prisma: ReturnType<typeof createPrismaMock>) {
  return new MeController(prisma as unknown as PrismaService);
}

describe("MeController self-service profile", () => {
  it("updates only the caller's own name and returns a minimal shape", async () => {
    const prisma = createPrismaMock();
    prisma.user.update.mockResolvedValue({
      id: userId,
      name: "Georgi Petrov",
      role: "STAFF",
      tenantId: "00000000-0000-0000-0000-000000000001",
      chatUserId: "12345",
    });
    const controller = controllerFor(prisma);

    const result = await controller.update({ id: userId }, { name: "Georgi Petrov" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: "Georgi Petrov" },
    });
    // No tenant/chat identifiers leak through the response.
    expect(result).toEqual({ id: userId, name: "Georgi Petrov", role: "STAFF" });
  });
});

describe("updateMeSchema", () => {
  it("rejects an empty name", () => {
    expect(updateMeSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("strips role/tenant keys so self-service can never escalate", () => {
    const parsed = updateMeSchema.parse({
      name: "Georgi",
      role: "OWNER",
      tenantId: "00000000-0000-0000-0000-000000000001",
    });
    expect(parsed).toEqual({ name: "Georgi" });
  });
});
