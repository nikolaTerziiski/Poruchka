// Inspect recent reminder instances. Run: pnpm --filter @poruchka/api exec node scripts/check-reminders.cjs
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "..", ".env");
for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i === -1) continue;
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  try {
    const now = new Date();
    console.log("now (UTC):", now.toISOString());
    const rows = await prisma.reminderInstance.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { schedule: { include: { item: true, assignedUser: true } } },
    });
    console.log("reminder_instances:", rows.length);
    for (const r of rows) {
      console.log({
        item: r.schedule.item.name,
        assignee: r.schedule.assignedUser.name,
        chatLinked: r.schedule.assignedUser.chatUserId ? "yes" : "no",
        dueDate: r.dueDate?.toISOString(),
        status: r.status,
        sentCount: r.sentCount,
        lastSentAt: r.lastSentAt?.toISOString() ?? null,
        nextNudgeAt: r.nextNudgeAt?.toISOString() ?? null,
      });
    }
  } catch (e) {
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
