-- Complete the supplier-order workflow already present in the live database.
-- Quantities become exact decimals; runs can then be confirmed and received.

ALTER TYPE "OrderRunStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "OrderRunStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_RECEIVED';
ALTER TYPE "OrderRunStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';

ALTER TABLE "order_rule_lines"
  ALTER COLUMN "defaultQuantity" TYPE NUMERIC(12,3)
  USING ROUND("defaultQuantity"::numeric, 3);

ALTER TABLE "order_run_lines"
  ALTER COLUMN "quantitySnapshot" TYPE NUMERIC(12,3)
  USING ROUND("quantitySnapshot"::numeric, 3),
  ADD COLUMN IF NOT EXISTS "receivedQuantity" NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS "unitPrice" NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS "exceptionType" TEXT,
  ADD COLUMN IF NOT EXISTS "exceptionNote" TEXT;

ALTER TABLE "order_runs"
  ADD COLUMN IF NOT EXISTS "supplierConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "supplierReference" TEXT,
  ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "receivingNote" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_run_lines_exceptionType_check'
      AND conrelid = 'public.order_run_lines'::regclass
  ) THEN
    ALTER TABLE "order_run_lines"
      ADD CONSTRAINT "order_run_lines_exceptionType_check"
      CHECK (
        "exceptionType" IS NULL OR
        "exceptionType" IN ('SHORT', 'MISSING', 'DAMAGED', 'SUBSTITUTED')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "order_rule_lines_orderRuleId_itemId_key"
  ON "order_rule_lines"("orderRuleId", "itemId");
CREATE UNIQUE INDEX IF NOT EXISTS "order_run_lines_orderRunId_itemId_key"
  ON "order_run_lines"("orderRunId", "itemId");
CREATE INDEX IF NOT EXISTS "order_rule_lines_itemId_idx" ON "order_rule_lines"("itemId");
CREATE INDEX IF NOT EXISTS "order_rules_assignedUserId_idx" ON "order_rules"("assignedUserId");
CREATE INDEX IF NOT EXISTS "order_rules_escalationUserId_idx" ON "order_rules"("escalationUserId");
CREATE INDEX IF NOT EXISTS "order_run_lines_itemId_idx" ON "order_run_lines"("itemId");
CREATE INDEX IF NOT EXISTS "order_runs_tenantId_dueDate_idx" ON "order_runs"("tenantId", "dueDate");
CREATE INDEX IF NOT EXISTS "order_runs_supplierId_idx" ON "order_runs"("supplierId");
CREATE INDEX IF NOT EXISTS "order_runs_assignedUserId_idx" ON "order_runs"("assignedUserId");
CREATE INDEX IF NOT EXISTS "order_runs_submittedByUserId_idx" ON "order_runs"("submittedByUserId");

ALTER TABLE "order_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_rule_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_run_lines" ENABLE ROW LEVEL SECURITY;
