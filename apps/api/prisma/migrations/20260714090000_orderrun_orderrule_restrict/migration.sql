-- Protect order history: deleting an OrderRule must not cascade-delete its OrderRuns.
-- OrderRun carries placed-order facts (submittedAt, unitPrice, receivedQuantity,
-- supplierReference) and must outlive the plan. Plans are soft-deleted via archivedAt.
ALTER TABLE "order_runs" DROP CONSTRAINT IF EXISTS "order_runs_orderRuleId_fkey";
ALTER TABLE "order_runs"
  ADD CONSTRAINT "order_runs_orderRuleId_fkey"
  FOREIGN KEY ("orderRuleId") REFERENCES "order_rules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
