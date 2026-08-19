/**
 * One-shot end-to-end check of the settings endpoints against the REAL
 * database and REAL Supabase auth (ES256 tokens via password grant).
 *
 * Boots the Nest app with TelegramBotService and SchedulerService overridden
 * to no-ops: no polling, no crons, no outbound messages. Creates a throwaway
 * tenant + two confirmed auth users (OWNER / STAFF), asserts the HTTP
 * behavior, then deletes everything it created.
 *
 * Run from apps/api:  npx ts-node src/e2e-settings.script.ts
 */
import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { TelegramBotService } from "./channels/telegram/telegram.bot.service";
import { SchedulerService } from "./scheduler/scheduler.service";

const PORT = 3011;
const BASE = `http://localhost:${PORT}`;

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* missing file is fine */
  }
  return out;
}

const apiEnv = loadEnvFile(join(__dirname, "..", ".env"));
const webEnv = loadEnvFile(join(__dirname, "..", "..", "web", ".env.local"));
for (const [k, v] of Object.entries(apiEnv)) if (!process.env[k]) process.env[k] = v;

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — aborting.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function adminCreateUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = (await res.json()) as { id?: string; msg?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`admin create ${email} failed: ${res.status} ${body.msg ?? body.message ?? ""}`);
  return body.id;
}

async function adminDeleteUser(id: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string; msg?: string };
  if (!res.ok || !body.access_token) throw new Error(`sign-in ${email} failed: ${res.status} ${body.error_description ?? body.msg ?? ""}`);
  return body.access_token;
}

async function call(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json };
}

async function main() {
  const stamp = Date.now();
  const ownerEmail = `poruchka-e2e-owner-${stamp}@example.com`;
  const staffEmail = `poruchka-e2e-staff-${stamp}@example.com`;
  const password = `E2e-${stamp}-Pass!`;

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

  let ownerAuthId: string | null = null;
  let staffAuthId: string | null = null;
  let tenantId: string | null = null;

  try {
    console.log("Creating throwaway auth users …");
    ownerAuthId = await adminCreateUser(ownerEmail, password);
    staffAuthId = await adminCreateUser(staffEmail, password);

    // Create the app-layer rows BEFORE any API call so the guard finds them
    // instead of auto-provisioning fresh OWNER tenants.
    const tenant = await prisma.tenant.create({
      data: {
        name: `E2E Settings Test ${stamp}`,
        users: {
          create: [
            { name: "E2E Owner", role: "OWNER", supabaseAuthId: ownerAuthId },
            { name: "E2E Staff", role: "STAFF", supabaseAuthId: staffAuthId },
          ],
        },
      },
    });
    tenantId = tenant.id;

    console.log("Signing in for real ES256 tokens …");
    const ownerToken = await signIn(ownerEmail, password);
    const staffToken = await signIn(staffEmail, password);

    console.log("Running assertions …");

    const meStaff = await call("GET", "/me", staffToken);
    check("STAFF GET /me resolves the pre-created row (no auto-provision)",
      meStaff.status === 200 && meStaff.json?.user?.role === "STAFF" && meStaff.json?.tenant?.id === tenantId,
      `status ${meStaff.status}, role ${meStaff.json?.user?.role}, tenant ${meStaff.json?.tenant?.id}`);

    const staffPatch = await call("PATCH", "/settings", staffToken, { maxNudges: 2 });
    check("STAFF PATCH /settings is forbidden (403)", staffPatch.status === 403, `status ${staffPatch.status}`);

    const staffRename = await call("PATCH", "/me", staffToken, { name: "E2E Staff Renamed" });
    check("STAFF PATCH /me updates own name (200)",
      staffRename.status === 200 && staffRename.json?.name === "E2E Staff Renamed",
      `status ${staffRename.status}`);

    const ownerPatch = await call("PATCH", "/settings", ownerToken, {
      name: "E2E Renamed Restaurant",
      timezone: "Europe/London",
      language: "en",
      quietHoursStart: 21,
      quietHoursEnd: 7,
      renudgeIntervalMin: 30,
      maxNudges: 3,
    });
    check("OWNER PATCH /settings applies a full update (200)",
      ownerPatch.status === 200 &&
        ownerPatch.json?.quietHoursStart === 21 &&
        ownerPatch.json?.renudgeIntervalMin === 30 &&
        ownerPatch.json?.timezone === "Europe/London" &&
        ownerPatch.json?.language === "en",
      `status ${ownerPatch.status}`);

    const meOwner = await call("GET", "/me", ownerToken);
    check("Changes persist through GET /me",
      meOwner.status === 200 && meOwner.json?.tenant?.maxNudges === 3 && meOwner.json?.tenant?.name === "E2E Renamed Restaurant",
      `status ${meOwner.status}`);

    const badTz = await call("PATCH", "/settings", ownerToken, { timezone: "Mars/Olympus" });
    check("Unknown timezone rejected (400)", badTz.status === 400, `status ${badTz.status}`);

    const badHour = await call("PATCH", "/settings", ownerToken, { quietHoursStart: 24 });
    check("Hour 24 rejected (400)", badHour.status === 400, `status ${badHour.status}`);

    const badInterval = await call("PATCH", "/settings", ownerToken, { renudgeIntervalMin: 4 });
    check("Interval below 5 min rejected (400)", badInterval.status === 400, `status ${badInterval.status}`);

    const smuggle = await call("PATCH", "/settings", ownerToken, { maxNudges: 4, id: "hijack", role: "OWNER" });
    check("Unknown keys are stripped, id untouched (200)",
      smuggle.status === 200 && smuggle.json?.id === tenantId && smuggle.json?.maxNudges === 4,
      `status ${smuggle.status}, id ${smuggle.json?.id}`);

    const emptyName = await call("PATCH", "/me", staffToken, { name: "" });
    check("Empty display name rejected (400)", emptyName.status === 400, `status ${emptyName.status}`);
  } finally {
    console.log("Cleaning up …");
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch((e) => console.error("tenant cleanup failed:", e));
    if (ownerAuthId) await adminDeleteUser(ownerAuthId).catch(() => {});
    if (staffAuthId) await adminDeleteUser(staffAuthId).catch(() => {});
    await app.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main().catch((e) => {
  console.error("E2E script crashed:", e);
  process.exit(1);
});
