ALTER TABLE "users" ADD COLUMN "encryptedVaultKey" TEXT;
ALTER TABLE "users" ADD COLUMN "adminEncryptedVaultKey" TEXT;
ALTER TABLE "users" ADD COLUMN "adminPublicKey" TEXT;
ALTER TABLE "users" ADD COLUMN "adminPrivateKeyEncrypted" TEXT;
