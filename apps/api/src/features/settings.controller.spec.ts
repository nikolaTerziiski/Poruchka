import { BadRequestException } from "@nestjs/common";
import { updateTenantSettingsSchema } from "@poruchka/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsController } from "./settings.controller";

const tenantId = "00000000-0000-0000-0000-000000000001";

function createPrismaMock() {
  return {
    tenant: {
      update: jest.fn(),
    },
  };
}

function controllerFor(prisma: ReturnType<typeof createPrismaMock>) {
  return new SettingsController(prisma as unknown as PrismaService);
}

describe("SettingsController tenant settings", () => {
  it("applies a partial update scoped to the caller's tenant", async () => {
    const prisma = createPrismaMock();
    const updated = { id: tenantId, quietHoursStart: 21, maxNudges: 3 };
    prisma.tenant.update.mockResolvedValue(updated);
    const controller = controllerFor(prisma);

    await expect(
      controller.update(tenantId, { quietHoursStart: 21, maxNudges: 3 }),
    ).resolves.toEqual(updated);

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenantId },
      data: { quietHoursStart: 21, maxNudges: 3 },
    });
  });

  it("rejects a syntactically plausible but unknown timezone", async () => {
    const prisma = createPrismaMock();
    const controller = controllerFor(prisma);

    await expect(controller.update(tenantId, { timezone: "Mars/Olympus" })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it("accepts any valid IANA timezone", async () => {
    const prisma = createPrismaMock();
    prisma.tenant.update.mockResolvedValue({ id: tenantId, timezone: "Europe/London" });
    const controller = controllerFor(prisma);

    await controller.update(tenantId, { timezone: "Europe/London" });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: tenantId },
      data: { timezone: "Europe/London" },
    });
  });
});

describe("updateTenantSettingsSchema bounds", () => {
  it("accepts every boundary value and the empty patch", () => {
    expect(
      updateTenantSettingsSchema.safeParse({
        quietHoursStart: 0,
        quietHoursEnd: 23,
        renudgeIntervalMin: 5,
        maxNudges: 1,
      }).success,
    ).toBe(true);
    expect(
      updateTenantSettingsSchema.safeParse({ renudgeIntervalMin: 720, maxNudges: 20 }).success,
    ).toBe(true);
    expect(updateTenantSettingsSchema.safeParse({}).success).toBe(true);
  });

  it.each([
    ["hour above 23", { quietHoursStart: 24 }],
    ["negative hour", { quietHoursEnd: -1 }],
    ["interval below 5", { renudgeIntervalMin: 4 }],
    ["interval above 720", { renudgeIntervalMin: 721 }],
    ["zero nudges", { maxNudges: 0 }],
    ["nudges above 20", { maxNudges: 21 }],
    ["fractional hour", { quietHoursStart: 21.5 }],
    ["unsupported language", { language: "de" }],
    ["empty name", { name: "" }],
    ["empty timezone", { timezone: "" }],
  ])("rejects %s", (_label, patch) => {
    expect(updateTenantSettingsSchema.safeParse(patch).success).toBe(false);
  });

  it("strips unknown keys so they never reach the database", () => {
    const parsed = updateTenantSettingsSchema.parse({
      maxNudges: 4,
      id: "someone-elses-tenant",
      createdAt: "2020-01-01",
    });
    expect(parsed).toEqual({ maxNudges: 4 });
  });
});
