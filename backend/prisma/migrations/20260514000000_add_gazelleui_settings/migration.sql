-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN "gazelleUiEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSettings" ADD COLUMN "gazelleUiUrl" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "gazelleUiApiKey" TEXT;
