/*
  Warnings:

  - You are about to drop the column `avgScore` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `messageCount` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `periodEnd` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `periodStart` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `sourceId` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `totalScore` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `userCount` on the `MetricSnapshot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[messageId,platformUserId,kind]` on the table `Reaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `messageId` to the `MetricSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MetricSnapshot" DROP CONSTRAINT "MetricSnapshot_sourceId_fkey";

-- DropIndex
DROP INDEX "MetricSnapshot_periodStart_periodEnd_idx";

-- DropIndex
DROP INDEX "MetricSnapshot_sourceId_createdAt_idx";

-- DropIndex
DROP INDEX "MetricSnapshot_sourceId_periodStart_idx";

-- AlterTable
ALTER TABLE "MetricSnapshot" DROP COLUMN "avgScore",
DROP COLUMN "createdAt",
DROP COLUMN "messageCount",
DROP COLUMN "periodEnd",
DROP COLUMN "periodStart",
DROP COLUMN "sourceId",
DROP COLUMN "totalScore",
DROP COLUMN "userCount",
ADD COLUMN     "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "likeCount" INTEGER,
ADD COLUMN     "messageId" TEXT NOT NULL,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "quoteCount" INTEGER,
ADD COLUMN     "replyCount" INTEGER,
ADD COLUMN     "repostCount" INTEGER,
ADD COLUMN     "viewCount" INTEGER;

-- CreateIndex
CREATE INDEX "MetricSnapshot_messageId_capturedAt_idx" ON "MetricSnapshot"("messageId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_messageId_platformUserId_kind_key" ON "Reaction"("messageId", "platformUserId", "kind");

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
