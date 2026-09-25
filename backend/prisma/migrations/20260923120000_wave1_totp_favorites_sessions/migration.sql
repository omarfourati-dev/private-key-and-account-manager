-- Welle 1: Favoriten/Zuletzt-verwendet, Sitzungs-Metadaten, Zwischenablage & Sprache

-- Entry: Favoriten und Nutzungszeitpunkt
ALTER TABLE "entries" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "entries" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
CREATE INDEX "entries_userId_isFavorite_idx" ON "entries"("userId", "isFavorite");

-- RefreshToken: Sitzungs-Metadaten (IP wird von der Anwendung gekuerzt geschrieben)
ALTER TABLE "refresh_tokens" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Settings: Zwischenablage-Timeout und Oberflaechensprache
ALTER TABLE "settings" ADD COLUMN "clipboardClearSecs" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "settings" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'de';
