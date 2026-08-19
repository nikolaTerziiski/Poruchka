-- A Telegram (or other chat) identity must map to at most one user per tenant,
-- so confirmation authorization and audit attribution are unambiguous. Replace
-- the non-unique lookup index with a unique constraint. chatUserId is nullable
-- and Postgres treats NULLs as distinct, so unlinked members remain unaffected.
DROP INDEX "users_tenantId_chatChannel_chatUserId_idx";

CREATE UNIQUE INDEX "users_tenantId_chatChannel_chatUserId_key" ON "users"("tenantId", "chatChannel", "chatUserId");
