/*
  Warnings:

  - You are about to drop the column `maxRewardPerUser` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Payout` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Reaction` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `Score` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Score` table. All the data in the column will be lost.
  - You are about to drop the column `identity` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Interactions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[sourceId,externalId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[wallet]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `timeframe` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Made the column `externalId` on table `Message` required. This step will fail if there are existing NULL values in that column.
  - Made the column `authorId` on table `Message` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `periodEnd` to the `Payout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periodStart` to the `Payout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformUserId` to the `Payout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformUserId` to the `Reaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformUserId` to the `Score` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Score` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RelationKind" AS ENUM ('REPLY_TO', 'QUOTE_OF', 'RETWEET_OF', 'REPOST_OF', 'THREAD_PARENT', 'MENTIONS');

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_userId_fkey";

-- DropIndex
DROP INDEX "Message_externalId_key";

-- DropIndex
DROP INDEX "idx_reaction_user_kind";

-- DropIndex
DROP INDEX "idx_score_user_kind";

-- DropIndex
DROP INDEX "User_identity_key";

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "maxRewardPerUser",
ADD COLUMN     "chainId" TEXT,
ADD COLUMN     "isNative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxRewardsPerUser" TEXT,
ADD COLUMN     "platforms" TEXT[],
ADD COLUMN     "timeframe" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "contentLang" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectId" TEXT NOT NULL,
ADD COLUMN     "sourceId" TEXT NOT NULL,
ALTER COLUMN "externalId" SET NOT NULL,
ALTER COLUMN "authorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payout" DROP COLUMN "updatedAt",
ADD COLUMN     "payoutAt" TIMESTAMP(3),
ADD COLUMN     "periodEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "platformUserId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Reaction" DROP COLUMN "userId",
ADD COLUMN     "platformUserId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Score" DROP COLUMN "source",
DROP COLUMN "userId",
ADD COLUMN     "details" JSONB,
ADD COLUMN     "platformUserId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "identity",
ADD COLUMN     "wallet" TEXT;

-- DropTable
DROP TABLE "Interactions";

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platform" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT NOT NULL,
    "crawlConfig" JSONB,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRelation" (
    "id" TEXT NOT NULL,
    "kind" "RelationKind" NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,

    CONSTRAINT "MessageRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordMessageDetail" (
    "messageId" TEXT NOT NULL,
    "guildId" TEXT,
    "channelId" TEXT,
    "threadId" TEXT,
    "embeds" JSONB,
    "attachments" JSONB,

    CONSTRAINT "DiscordMessageDetail_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "avgScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestCheckpoint" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceId" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "lastTimestamp" TIMESTAMP(3),
    "cursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),

    CONSTRAINT "IngestCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformUser_userId_idx" ON "PlatformUser"("userId");

-- CreateIndex
CREATE INDEX "PlatformUser_platform_platformId_idx" ON "PlatformUser"("platform", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_platform_platformId_key" ON "PlatformUser"("platform", "platformId");

-- CreateIndex
CREATE INDEX "Source_projectId_isActive_idx" ON "Source"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "Source_platform_isActive_idx" ON "Source"("platform", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Source_platform_platformId_key" ON "Source"("platform", "platformId");

-- CreateIndex
CREATE INDEX "MessageRelation_fromId_kind_idx" ON "MessageRelation"("fromId", "kind");

-- CreateIndex
CREATE INDEX "MessageRelation_toId_kind_idx" ON "MessageRelation"("toId", "kind");

-- CreateIndex
CREATE INDEX "MessageRelation_kind_idx" ON "MessageRelation"("kind");

-- CreateIndex
CREATE INDEX "DiscordMessageDetail_guildId_idx" ON "DiscordMessageDetail"("guildId");

-- CreateIndex
CREATE INDEX "DiscordMessageDetail_channelId_idx" ON "DiscordMessageDetail"("channelId");

-- CreateIndex
CREATE INDEX "DiscordMessageDetail_threadId_idx" ON "DiscordMessageDetail"("threadId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_sourceId_createdAt_idx" ON "MetricSnapshot"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "MetricSnapshot_periodStart_periodEnd_idx" ON "MetricSnapshot"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "MetricSnapshot_sourceId_periodStart_idx" ON "MetricSnapshot"("sourceId", "periodStart");

-- CreateIndex
CREATE INDEX "IngestCheckpoint_status_updatedAt_idx" ON "IngestCheckpoint"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestCheckpoint_sourceId_key" ON "IngestCheckpoint"("sourceId");

-- CreateIndex
CREATE INDEX "Campaign_platforms_idx" ON "Campaign"("platforms");

-- CreateIndex
CREATE INDEX "Message_authorId_createdAt_idx" ON "Message"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_sourceId_createdAt_idx" ON "Message"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_isDeleted_createdAt_idx" ON "Message"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "Message_projectId_createdAt_idx" ON "Message"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_sourceId_externalId_key" ON "Message"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "Payout_periodStart_periodEnd_idx" ON "Payout"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Payout_platformUserId_campaignId_idx" ON "Payout"("platformUserId", "campaignId");

-- CreateIndex
CREATE INDEX "Reaction_platformUserId_kind_idx" ON "Reaction"("platformUserId", "kind");

-- CreateIndex
CREATE INDEX "Reaction_messageId_platformUserId_idx" ON "Reaction"("messageId", "platformUserId");

-- CreateIndex
CREATE INDEX "Score_platformUserId_kind_idx" ON "Score"("platformUserId", "kind");

-- CreateIndex
CREATE INDEX "Score_messageId_platformUserId_idx" ON "Score"("messageId", "platformUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE INDEX "User_wallet_idx" ON "User"("wallet");

-- CreateIndex
CREATE INDEX "User_trust_idx" ON "User"("trust");

-- AddForeignKey
ALTER TABLE "PlatformUser" ADD CONSTRAINT "PlatformUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRelation" ADD CONSTRAINT "MessageRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRelation" ADD CONSTRAINT "MessageRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordMessageDetail" ADD CONSTRAINT "DiscordMessageDetail_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestCheckpoint" ADD CONSTRAINT "IngestCheckpoint_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_campaign_active" RENAME TO "Campaign_isActive_idx";

-- RenameIndex
ALTER INDEX "idx_campaign_dates" RENAME TO "Campaign_startDate_endDate_idx";

-- RenameIndex
ALTER INDEX "idx_events_raw_project_platform" RENAME TO "EventsRaw_projectId_platform_idx";

-- RenameIndex
ALTER INDEX "idx_events_raw_project_ts" RENAME TO "EventsRaw_projectId_ts_idx";

-- RenameIndex
ALTER INDEX "idx_events_raw_type_ts" RENAME TO "EventsRaw_type_ts_idx";

-- RenameIndex
ALTER INDEX "idx_payout_created" RENAME TO "Payout_createdAt_idx";

-- RenameIndex
ALTER INDEX "idx_payout_status" RENAME TO "Payout_status_idx";

-- RenameIndex
ALTER INDEX "idx_payout_user_campaign" RENAME TO "Payout_userId_campaignId_idx";

-- RenameIndex
ALTER INDEX "idx_reaction_message_kind" RENAME TO "Reaction_messageId_kind_idx";

-- RenameIndex
ALTER INDEX "idx_score_message_kind" RENAME TO "Score_messageId_kind_idx";

-- RenameIndex
ALTER INDEX "idx_system_config_key" RENAME TO "SystemConfig_key_idx";
