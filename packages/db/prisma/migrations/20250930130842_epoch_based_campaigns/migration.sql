-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EpochState" AS ENUM ('OPEN', 'CLAIMING', 'RECYCLED', 'EXPIRED', 'CLOSED');

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "minScore",
DROP COLUMN "timeframe",
ALTER COLUMN "totalRewardPool" SET DATA TYPE DECIMAL(78,0),
ALTER COLUMN "maxRewardsPerUser" SET DATA TYPE DECIMAL(78,0),
ALTER COLUMN "startDate" DROP NOT NULL,
ALTER COLUMN "endDate" DROP NOT NULL,
ADD COLUMN     "isFunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "vaultAddress" TEXT,
ADD COLUMN     "fundingTxHash" TEXT,
ADD COLUMN     "payoutIntervalSeconds" INTEGER NOT NULL DEFAULT 604800,
ADD COLUMN     "epochRewardCap" DECIMAL(78,0) NOT NULL DEFAULT 0,
ADD COLUMN     "claimWindowSeconds" INTEGER NOT NULL DEFAULT 604800,
ADD COLUMN     "recycleUnclaimed" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Payout" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(78,0),
ADD COLUMN     "epochId" TEXT;

-- CreateTable
CREATE TABLE "CampaignEpoch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "epochNumber" INTEGER NOT NULL,
    "epochStart" TIMESTAMP(3) NOT NULL,
    "epochEnd" TIMESTAMP(3) NOT NULL,
    "claimWindowEnds" TIMESTAMP(3) NOT NULL,
    "allocated" DECIMAL(78,0) NOT NULL,
    "claimed" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "recycledAt" TIMESTAMP(3),
    "state" "EpochState" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "CampaignEpoch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_isFunded_idx" ON "Campaign"("isFunded");

-- CreateIndex
CREATE INDEX "Payout_epochId_idx" ON "Payout"("epochId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEpoch_campaignId_epochNumber_key" ON "CampaignEpoch"("campaignId", "epochNumber");

-- CreateIndex
CREATE INDEX "CampaignEpoch_campaignId_state_idx" ON "CampaignEpoch"("campaignId", "state");

-- CreateIndex
CREATE INDEX "CampaignEpoch_epochStart_epochEnd_claimWindowEnds_idx" ON "CampaignEpoch"("epochStart", "epochEnd", "claimWindowEnds");

-- AddForeignKey
ALTER TABLE "CampaignEpoch" ADD CONSTRAINT "CampaignEpoch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "CampaignEpoch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
