-- Add performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS "entries_userId_idx" ON "entries"("userId");
CREATE INDEX IF NOT EXISTS "entries_userId_type_idx" ON "entries"("userId", "type");
