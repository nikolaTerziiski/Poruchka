-- Reconstruct the supplier-order model for databases created from this repo.
-- The production database received this model through historical migrations
-- that were not retained locally; every statement is safe on that database.

-- One Telegram/Viber identity may only be linked once inside a restaurant.
DROP INDEX IF EXISTS "users_tenantId_chatChannel_chatUserId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_chatChannel_chatUserId_key"
  ON "users"("tenantId", "chatChannel", "chatUserId");

DO $$
BEGIN
  CREATE TYPE "OrderRunStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ESCALATED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "order_rules" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "assignedUserId" UUID NOT NULL,
  "escalationUserId" UUID,
  "reminderTimeOfDay" TEXT NOT NULL,
  "recurrence" JSONB NOT NULL,
  "cutoffTime" TEXT,
  "expectedDeliveryOffsetDays" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "order_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_rules_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_rules_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_rules_escalationUserId_fkey" FOREIGN KEY ("escalationUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "order_rule_lines" (
  "id" UUID NOT NULL,
  "orderRuleId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "defaultQuantity" DOUBLE PRECISION,
  "unit" TEXT,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "order_rule_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_rule_lines_orderRuleId_fkey" FOREIGN KEY ("orderRuleId") REFERENCES "order_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_rule_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "order_runs" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "orderRuleId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "assignedUserId" UUID NOT NULL,
  "dueDate" DATE NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "expectedDeliveryDate" DATE,
  "status" "OrderRunStatus" NOT NULL DEFAULT 'PENDING',
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMP(3),
  "nextNudgeAt" TIMESTAMP(3),
  "postponedCount" INTEGER NOT NULL DEFAULT 0,
  "lastPostponedAt" TIMESTAMP(3),
  "postponedUntil" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "submittedByUserId" UUID,
  "skipReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "order_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_runs_orderRuleId_fkey" FOREIGN KEY ("orderRuleId") REFERENCES "order_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_runs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_runs_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_runs_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "order_run_lines" (
  "id" UUID NOT NULL,
  "orderRunId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "itemNameSnapshot" TEXT NOT NULL,
  "quantitySnapshot" DOUBLE PRECISION,
  "unitSnapshot" TEXT,
  "notesSnapshot" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "order_run_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_run_lines_orderRunId_fkey" FOREIGN KEY ("orderRunId") REFERENCES "order_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_run_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "order_rules_tenantId_idx" ON "order_rules"("tenantId");
CREATE INDEX IF NOT EXISTS "order_rules_tenantId_archivedAt_idx" ON "order_rules"("tenantId", "archivedAt");
CREATE INDEX IF NOT EXISTS "order_rules_supplierId_idx" ON "order_rules"("supplierId");
CREATE INDEX IF NOT EXISTS "order_rule_lines_orderRuleId_idx" ON "order_rule_lines"("orderRuleId");
CREATE INDEX IF NOT EXISTS "order_runs_tenantId_idx" ON "order_runs"("tenantId");
CREATE INDEX IF NOT EXISTS "order_runs_status_nextNudgeAt_idx" ON "order_runs"("status", "nextNudgeAt");
CREATE UNIQUE INDEX IF NOT EXISTS "order_runs_orderRuleId_dueDate_key" ON "order_runs"("orderRuleId", "dueDate");
CREATE INDEX IF NOT EXISTS "order_run_lines_orderRunId_idx" ON "order_run_lines"("orderRunId");

-- Preserve any data from the original one-item schedule/reminder model.
DO $$
BEGIN
  IF to_regclass('schedules') IS NOT NULL THEN
    INSERT INTO "order_rules" (
      "id", "tenantId", "supplierId", "assignedUserId", "reminderTimeOfDay",
      "recurrence", "active", "createdAt", "updatedAt"
    )
    SELECT
      schedule."id", schedule."tenantId", item."supplierId", schedule."assignedUserId",
      schedule."reminderTimeOfDay", schedule."recurrence", schedule."active",
      schedule."createdAt", schedule."updatedAt"
    FROM "schedules" AS schedule
    JOIN "items" AS item ON item."id" = schedule."itemId"
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "order_rule_lines" (
      "id", "orderRuleId", "itemId", "unit", "notes", "sortOrder"
    )
    SELECT
      schedule."id", schedule."id", schedule."itemId", item."unit", item."notes", 0
    FROM "schedules" AS schedule
    JOIN "items" AS item ON item."id" = schedule."itemId"
    ON CONFLICT ("id") DO NOTHING;
  END IF;

  IF to_regclass('reminder_instances') IS NOT NULL
     AND to_regclass('schedules') IS NOT NULL THEN
    INSERT INTO "order_runs" (
      "id", "tenantId", "orderRuleId", "supplierId", "assignedUserId",
      "dueDate", "dueAt", "status", "sentCount", "lastSentAt", "nextNudgeAt",
      "submittedAt", "submittedByUserId", "skipReason", "createdAt", "updatedAt"
    )
    SELECT
      reminder."id", reminder."tenantId", schedule."id", item."supplierId",
      schedule."assignedUserId", reminder."dueDate",
      reminder."dueDate"::timestamp + COALESCE(NULLIF(schedule."reminderTimeOfDay", ''), '09:00')::time,
      CASE reminder."status"::text
        WHEN 'CONFIRMED' THEN 'SUBMITTED'::"OrderRunStatus"
        WHEN 'ESCALATED' THEN 'ESCALATED'::"OrderRunStatus"
        WHEN 'CANCELLED' THEN 'SKIPPED'::"OrderRunStatus"
        ELSE 'PENDING'::"OrderRunStatus"
      END,
      reminder."sentCount", reminder."lastSentAt", reminder."nextNudgeAt",
      reminder."confirmedAt", reminder."confirmedByUserId",
      CASE WHEN reminder."status"::text = 'CANCELLED' THEN 'Migrated from cancelled reminder' END,
      reminder."createdAt", reminder."updatedAt"
    FROM "reminder_instances" AS reminder
    JOIN "schedules" AS schedule ON schedule."id" = reminder."scheduleId"
    JOIN "items" AS item ON item."id" = schedule."itemId"
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "order_run_lines" (
      "id", "orderRunId", "itemId", "itemNameSnapshot", "unitSnapshot",
      "notesSnapshot", "sortOrder"
    )
    SELECT
      reminder."id", reminder."id", item."id", item."name", item."unit", item."notes", 0
    FROM "reminder_instances" AS reminder
    JOIN "schedules" AS schedule ON schedule."id" = reminder."scheduleId"
    JOIN "items" AS item ON item."id" = schedule."itemId"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "reminder_instances";
DROP TABLE IF EXISTS "schedules";
DROP TYPE IF EXISTS "ReminderStatus";

ALTER TABLE "order_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_rule_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_run_lines" ENABLE ROW LEVEL SECURITY;
