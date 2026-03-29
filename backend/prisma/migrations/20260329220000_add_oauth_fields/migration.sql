-- AlterTable: make passwordHash optional and add OAuth ID fields
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AddColumn: googleId
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;

-- AddColumn: appleId
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "appleId" TEXT;

-- CreateIndex: unique googleId
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");

-- CreateIndex: unique appleId
CREATE UNIQUE INDEX IF NOT EXISTS "users_appleId_key" ON "users"("appleId");
