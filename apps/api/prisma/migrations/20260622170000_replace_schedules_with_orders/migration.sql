-- Replace the per-item Schedule/ReminderInstance model with the per-supplier
-- order model (OrderRule/OrderRuleLine/OrderRun/OrderRunLine). The catalog
-- (suppliers, items) is unchanged. This DROPS schedules and reminder_instances.

-- CreateEnum
CREATE TYPE "OrderRunStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ESCALATED', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_itemId_fkey";

-- DropForeignKey
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_assignedUserId_fkey";

-- DropForeignKey
ALTER TABLE "reminder_instances" DROP CONSTRAINT "reminder_instances_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "reminder_instances" DROP CONSTRAINT "reminder_instances_scheduleId_fkey";

-- DropForeignKey
ALTER TABLE "reminder_instances" DROP CONSTRAINT "reminder_instances_confirmedByUserId_fkey";

-- DropTable
DROP TABLE "schedules";

-- DropTable
DROP TABLE "reminder_instances";

-- DropEnum
DROP TYPE "ReminderStatus";

-- CreateTable
CREATE TABLE "order_rules" (
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

    CONSTRAINT "order_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_rule_lines" (
    "id" UUID NOT NULL,
    "orderRuleId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "defaultQuantity" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_rule_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_runs" (
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

    CONSTRAINT "order_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_run_lines" (
    "id" UUID NOT NULL,
    "orderRunId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "quantitySnapshot" DOUBLE PRECISION,
    "unitSnapshot" TEXT,
    "notesSnapshot" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_rules_tenantId_idx" ON "order_rules"("tenantId");

-- CreateIndex
CREATE INDEX "order_rules_supplierId_idx" ON "order_rules"("supplierId");

-- CreateIndex
CREATE INDEX "order_rule_lines_orderRuleId_idx" ON "order_rule_lines"("orderRuleId");

-- CreateIndex
CREATE INDEX "order_runs_tenantId_idx" ON "order_runs"("tenantId");

-- CreateIndex
CREATE INDEX "order_runs_status_nextNudgeAt_idx" ON "order_runs"("status", "nextNudgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_runs_orderRuleId_dueDate_key" ON "order_runs"("orderRuleId", "dueDate");

-- CreateIndex
CREATE INDEX "order_run_lines_orderRunId_idx" ON "order_run_lines"("orderRunId");

-- AddForeignKey
ALTER TABLE "order_rules" ADD CONSTRAINT "order_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rules" ADD CONSTRAINT "order_rules_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rules" ADD CONSTRAINT "order_rules_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rules" ADD CONSTRAINT "order_rules_escalationUserId_fkey" FOREIGN KEY ("escalationUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rule_lines" ADD CONSTRAINT "order_rule_lines_orderRuleId_fkey" FOREIGN KEY ("orderRuleId") REFERENCES "order_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rule_lines" ADD CONSTRAINT "order_rule_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_runs" ADD CONSTRAINT "order_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_runs" ADD CONSTRAINT "order_runs_orderRuleId_fkey" FOREIGN KEY ("orderRuleId") REFERENCES "order_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_runs" ADD CONSTRAINT "order_runs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_runs" ADD CONSTRAINT "order_runs_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_runs" ADD CONSTRAINT "order_runs_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_run_lines" ADD CONSTRAINT "order_run_lines_orderRunId_fkey" FOREIGN KEY ("orderRunId") REFERENCES "order_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_run_lines" ADD CONSTRAINT "order_run_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
