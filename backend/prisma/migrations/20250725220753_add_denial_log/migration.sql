/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `AuditLog` table. All the data in the column will be lost.
  - Made the column `targetId` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "AuditLog_createdAt_idx";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "createdAt",
DROP COLUMN "details",
ADD COLUMN     "changes" JSONB,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "targetId" SET NOT NULL;

-- CreateTable
CREATE TABLE "AccessDenialLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "searchQuery" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "groupId" TEXT,
    "accessLevel" TEXT NOT NULL,
    "denialReason" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessDenialLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessDenialLog_organizationId_idx" ON "AccessDenialLog"("organizationId");

-- CreateIndex
CREATE INDEX "AccessDenialLog_userId_idx" ON "AccessDenialLog"("userId");

-- CreateIndex
CREATE INDEX "AccessDenialLog_groupId_idx" ON "AccessDenialLog"("groupId");

-- CreateIndex
CREATE INDEX "AccessDenialLog_timestamp_idx" ON "AccessDenialLog"("timestamp");

-- CreateIndex
CREATE INDEX "AccessDenialLog_userId_groupId_idx" ON "AccessDenialLog"("userId", "groupId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "AccessDenialLog" ADD CONSTRAINT "AccessDenialLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessDenialLog" ADD CONSTRAINT "AccessDenialLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
