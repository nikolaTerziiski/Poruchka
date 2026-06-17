// Idempotent seed for the family pilot. Run: pnpm --filter @poruchka/api run db:seed
const fs = require("fs");
const path = require("path");

// Minimal .env loader (no dependency).
const envPath = path.join(__dirname, "..", ".env");
for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i === -1) continue;
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Fixed ids keep the seed idempotent (safe to re-run).
const IDS = {
  tenant: "11111111-1111-4111-8111-111111111111",
  owner: "22222222-2222-4222-8222-222222222222",
  metro: "33333333-3333-4333-8333-333333333333",
  pork: "44444444-4444-4444-8444-444444444444",
  schedule: "55555555-5555-4555-8555-555555555555",
};

(async () => {
  try {
    await prisma.tenant.upsert({
      where: { id: IDS.tenant },
      update: {},
      create: { id: IDS.tenant, name: "Poruchka Pilot (Family Restaurant)", timezone: "Europe/Sofia" },
    });

    await prisma.user.upsert({
      where: { id: IDS.owner },
      update: {},
      create: { id: IDS.owner, tenantId: IDS.tenant, name: "Owner", role: "OWNER", chatChannel: "TELEGRAM" },
    });

    await prisma.supplier.upsert({
      where: { id: IDS.metro },
      update: {},
      create: { id: IDS.metro, tenantId: IDS.tenant, name: "Metro" },
    });

    await prisma.item.upsert({
      where: { id: IDS.pork },
      update: {},
      create: { id: IDS.pork, tenantId: IDS.tenant, name: "Pork Meat", supplierId: IDS.metro, unit: "kg" },
    });

    await prisma.schedule.upsert({
      where: { id: IDS.schedule },
      update: {},
      create: {
        id: IDS.schedule,
        tenantId: IDS.tenant,
        itemId: IDS.pork,
        assignedUserId: IDS.owner,
        reminderTimeOfDay: "09:00",
        recurrence: { type: "weekly", weekdays: [3] }, // every Wednesday (ISO 3)
        active: true,
      },
    });

    console.log("Seed OK:", {
      tenants: await prisma.tenant.count(),
      users: await prisma.user.count(),
      suppliers: await prisma.supplier.count(),
      items: await prisma.item.count(),
      schedules: await prisma.schedule.count(),
    });
  } catch (e) {
    console.error("Seed FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
