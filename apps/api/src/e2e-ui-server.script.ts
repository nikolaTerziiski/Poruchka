/**
 * UI-test server: boots the API on :3001 with TelegramBotService and
 * SchedulerService overridden to no-ops (no polling, no crons, no sends),
 * then seeds a throwaway tenant with realistic data covering every UI state.
 * Prints throwaway login credentials and stays alive until killed.
 *
 * Cleanup: delete the tenant + auth user listed in the ids file it writes.
 *
 * Run from apps/api:  npx ts-node src/e2e-ui-server.script.ts
 */
import "reflect-metadata";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DateTime } from "luxon";
import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { TelegramBotService } from "./channels/telegram/telegram.bot.service";
import { SchedulerService } from "./scheduler/scheduler.service";

const PORT = 3001;
const ZONE = "Europe/Sofia";
const IDS_FILE = join(__dirname, "..", "ui-test-ids.json");

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
  return out;
}

const apiEnv = loadEnvFile(join(__dirname, "..", ".env"));
for (const [k, v] of Object.entries(apiEnv)) if (!process.env[k]) process.env[k] = v;

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function adminCreateUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { restaurant_name: "Бистро Витоша" },
    }),
  });
  const body = (await res.json()) as { id?: string; msg?: string };
  if (!res.ok || !body.id) throw new Error(`admin create failed: ${res.status} ${body.msg ?? ""}`);
  return body.id;
}

/** Sofia-local "HH:mm" today (or offset by days) as a JS Date instant. */
function at(dayOffset: number, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return DateTime.now().setZone(ZONE).plus({ days: dayOffset }).set({ hour: h, minute: m, second: 0, millisecond: 0 }).toJSDate();
}

/** Date-only (UTC midnight) for dueDate columns. */
function day(dayOffset: number): Date {
  const iso = DateTime.now().setZone(ZONE).plus({ days: dayOffset }).toISODate();
  return new Date(`${iso}T00:00:00Z`);
}

async function main() {
  const stamp = Date.now();
  const email = `poruchka-uitest-${stamp}@example.com`;
  const password = `UiTest-${stamp}!`;

  console.log("Booting API (bot + scheduler disabled) …");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TelegramBotService)
    .useValue({})
    .overrideProvider(SchedulerService)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication();
  app.enableCors({ origin: true });
  await app.listen(PORT);
  const prisma = app.get(PrismaService);

  console.log("Creating throwaway auth user + seeded tenant …");
  const authId = await adminCreateUser(email, password);

  const tenant = await prisma.tenant.create({
    data: { name: "Бистро Витоша", language: "bg" },
  });
  const owner = await prisma.user.create({
    data: { tenantId: tenant.id, name: "Никола Терзийски", role: "OWNER", supabaseAuthId: authId },
  });
  const georgi = await prisma.user.create({
    data: { tenantId: tenant.id, name: "Георги Иванов", role: "STAFF" },
  });
  const elena = await prisma.user.create({
    data: { tenantId: tenant.id, name: "Елена Петрова", role: "MANAGER" },
  });

  const metro = await prisma.supplier.create({
    data: { tenantId: tenant.id, name: "Метро", contact: "+359 88 555 1234" },
  });
  const biomes = await prisma.supplier.create({
    data: { tenantId: tenant.id, name: "БиоМес ООД", contact: "+359 87 222 9911" },
  });
  const fresh = await prisma.supplier.create({
    data: { tenantId: tenant.id, name: "Фреш Маркет" },
  });

  async function item(supplierId: string, name: string, unit: string, notes?: string) {
    return prisma.item.create({ data: { tenantId: tenant.id, supplierId, name, unit, notes } });
  }
  const pork = await item(metro.id, "Свинско месо", "кг", "постно, за скара");
  const chicken = await item(metro.id, "Пилешко филе", "кг");
  const oil = await item(metro.id, "Олио", "л");
  const rice = await item(metro.id, "Ориз", "кг");
  const mince = await item(biomes.id, "Телешка кайма", "кг");
  const lamb = await item(biomes.id, "Агнешко бут", "кг");
  const tomatoes = await item(fresh.id, "Домати", "кг");
  const cucumbers = await item(fresh.id, "Краставици", "кг");
  const cheese = await item(fresh.id, "Сирене", "кг", "краве, БДС");

  const metroRule = await prisma.orderRule.create({
    data: {
      tenantId: tenant.id,
      supplierId: metro.id,
      assignedUserId: georgi.id,
      escalationUserId: owner.id,
      reminderTimeOfDay: "09:00",
      recurrence: { type: "weekly", weekdays: [3] },
      cutoffTime: "14:00",
      expectedDeliveryOffsetDays: 2,
      lines: {
        create: [
          { itemId: pork.id, defaultQuantity: 20, unit: "кг", sortOrder: 0 },
          { itemId: chicken.id, defaultQuantity: 10, unit: "кг", sortOrder: 1 },
          { itemId: oil.id, defaultQuantity: 5, unit: "л", sortOrder: 2 },
          { itemId: rice.id, defaultQuantity: 25, unit: "кг", sortOrder: 3 },
        ],
      },
    },
  });
  const biomesRule = await prisma.orderRule.create({
    data: {
      tenantId: tenant.id,
      supplierId: biomes.id,
      assignedUserId: elena.id,
      reminderTimeOfDay: "10:00",
      recurrence: { type: "weekly", weekdays: [5] },
      lines: {
        create: [
          { itemId: mince.id, defaultQuantity: 8, unit: "кг", sortOrder: 0 },
          { itemId: lamb.id, defaultQuantity: 6, unit: "кг", sortOrder: 1 },
        ],
      },
    },
  });
  const freshRule = await prisma.orderRule.create({
    data: {
      tenantId: tenant.id,
      supplierId: fresh.id,
      assignedUserId: georgi.id,
      reminderTimeOfDay: "08:30",
      recurrence: { type: "daily" },
      cutoffTime: "11:00",
      lines: {
        create: [
          { itemId: tomatoes.id, defaultQuantity: 15, unit: "кг", sortOrder: 0 },
          { itemId: cucumbers.id, defaultQuantity: 10, unit: "кг", sortOrder: 1 },
          { itemId: cheese.id, defaultQuantity: 4, unit: "кг", sortOrder: 2 },
        ],
      },
    },
  });

  const freshLines = [
    { itemId: tomatoes.id, itemNameSnapshot: "Домати", quantitySnapshot: 15, unitSnapshot: "кг", sortOrder: 0 },
    { itemId: cucumbers.id, itemNameSnapshot: "Краставици", quantitySnapshot: 10, unitSnapshot: "кг", sortOrder: 1 },
    { itemId: cheese.id, itemNameSnapshot: "Сирене", quantitySnapshot: 4, unitSnapshot: "кг", sortOrder: 2 },
  ];

  // Today: escalated (attention strip), submitted (confirmed timeline), pending+postponed.
  await prisma.orderRun.create({
    data: {
      tenantId: tenant.id, orderRuleId: freshRule.id, supplierId: fresh.id, assignedUserId: georgi.id,
      dueDate: day(0), dueAt: at(0, "08:30"), status: "ESCALATED",
      sentCount: 5, lastSentAt: at(0, "10:30"), nextNudgeAt: null,
      lines: { create: freshLines },
    },
  });
  await prisma.orderRun.create({
    data: {
      tenantId: tenant.id, orderRuleId: biomesRule.id, supplierId: biomes.id, assignedUserId: elena.id,
      dueDate: day(0), dueAt: at(0, "10:00"), status: "SUBMITTED",
      sentCount: 1, lastSentAt: at(0, "10:00"), submittedAt: at(0, "10:32"), submittedByUserId: elena.id,
      expectedDeliveryDate: day(2),
      lines: {
        create: [
          { itemId: mince.id, itemNameSnapshot: "Телешка кайма", quantitySnapshot: 8, unitSnapshot: "кг", sortOrder: 0 },
          { itemId: lamb.id, itemNameSnapshot: "Агнешко бут", quantitySnapshot: 6, unitSnapshot: "кг", sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.orderRun.create({
    data: {
      tenantId: tenant.id, orderRuleId: metroRule.id, supplierId: metro.id, assignedUserId: georgi.id,
      dueDate: day(0), dueAt: at(0, "09:00"), status: "PENDING",
      sentCount: 1, lastSentAt: at(0, "09:00"),
      postponedCount: 1, lastPostponedAt: at(0, "09:05"), postponedUntil: at(0, "12:00"), nextNudgeAt: at(0, "12:00"),
      lines: {
        create: [
          { itemId: pork.id, itemNameSnapshot: "Свинско месо", quantitySnapshot: 20, unitSnapshot: "кг", notesSnapshot: "постно, за скара", sortOrder: 0 },
          { itemId: chicken.id, itemNameSnapshot: "Пилешко филе", quantitySnapshot: 10, unitSnapshot: "кг", sortOrder: 1 },
          { itemId: oil.id, itemNameSnapshot: "Олио", quantitySnapshot: 5, unitSnapshot: "л", sortOrder: 2 },
          { itemId: rice.id, itemNameSnapshot: "Ориз", quantitySnapshot: 25, unitSnapshot: "кг", sortOrder: 3 },
        ],
      },
    },
  });
  // Earlier this week: submitted + skipped history for the week-strip dots.
  await prisma.orderRun.create({
    data: {
      tenantId: tenant.id, orderRuleId: freshRule.id, supplierId: fresh.id, assignedUserId: georgi.id,
      dueDate: day(-1), dueAt: at(-1, "08:30"), status: "SUBMITTED",
      sentCount: 1, lastSentAt: at(-1, "08:30"), submittedAt: at(-1, "09:05"), submittedByUserId: georgi.id,
      lines: { create: freshLines },
    },
  });
  await prisma.orderRun.create({
    data: {
      tenantId: tenant.id, orderRuleId: freshRule.id, supplierId: fresh.id, assignedUserId: georgi.id,
      dueDate: day(-2), dueAt: at(-2, "08:30"), status: "SKIPPED", skipReason: "затворено — празник",
      lines: { create: freshLines },
    },
  });

  writeFileSync(IDS_FILE, JSON.stringify({ tenantId: tenant.id, authId, email }, null, 2));

  console.log("READY");
  console.log(`LOGIN_EMAIL=${email}`);
  console.log(`LOGIN_PASSWORD=${password}`);
  console.log(`TENANT_ID=${tenant.id}`);
  console.log(`IDS_FILE=${IDS_FILE}`);

  await new Promise(() => {}); // stay alive until killed
}

void main().catch((e) => {
  console.error("UI server crashed:", e);
  process.exit(1);
});
