-- Archive recurring order rules instead of deleting them, so historical
-- order_runs remain attached to their source configuration.
ALTER TABLE "order_rules" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "order_rules_tenantId_archivedAt_idx" ON "order_rules"("tenantId", "archivedAt");
