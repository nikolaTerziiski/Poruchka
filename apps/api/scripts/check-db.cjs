// Quick connectivity + schema check. Run: pnpm --filter @poruchka/api exec node scripts/check-db.cjs
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

(async () => {
  try {
    const tables = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
    );
    console.log("Public tables:", tables.map((t) => t.table_name).join(", "));
    // .count() exercises the runtime DATABASE_URL (transaction pooler, 6543).
    console.log("tenant.count() via pooler =", await prisma.tenant.count());
    console.log("DB VERIFY OK");
  } catch (e) {
    console.error("DB VERIFY FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
