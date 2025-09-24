import { PrismaClient } from '@prisma/client';
import type { EventEnvelope } from '@ally/events/envelope';

// Import types directly from the generated client
import type { 
  User, 
  PlatformUser, 
  Source, 
  Message, 
  Score, 
  Reaction, 
  MessageRelation, 
  DiscordMessageDetail,
  MetricSnapshot,
  IngestCheckpoint,
  Campaign,
  Payout,
  PayoutStatus,
  RelationKind
} from '@prisma/client';

// Type definitions for function parameters
export interface SaveMessageData {
  projectId: string;
  sourceId: string;
  externalId: string;
  authorId: string;
  content: string;
  contentLang?: string;
}

export interface UpdateMessageData {
  content?: string;
  isDeleted?: boolean;
}

export interface SaveScoreData {
  messageId: string;
  platformUserId: string;
  kind: string;
  value: number;
  details?: any;
}

export interface AddReactionData {
  messageId: string;
  platformUserId: string;
  kind: string;
  weight?: number;
}

export interface IngestCheckpointData {
  lastMessageId?: string;
  lastTimestamp?: Date;
  cursor?: string;
  status?: string;
}

export interface SaveMetricSnapshotData {
  messageId: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  viewCount?: number;
  meta?: any;
}

export interface CampaignData {
  name: string;
  description?: string;
  tokenSymbol: string;
  isNative: boolean;
  chainId?: string;
  tokenAddress?: string;
  totalRewardPool: string;
  startDate: Date;
  endDate: Date;
  minScore?: number;
  maxRewardsPerUser?: string;
  timeframe: number;
  platforms: string[];
  createdById: string;
}

export interface PayoutData {
  platformUserId: string;
  userId: string;
  campaignId: string;
  amount: string;
  periodStart: Date;
  periodEnd: Date;
  processedById?: string;
}

export interface PersistenceService {
  // User Management
  upsertUser(wallet: string, displayName?: string): Promise<User>;
  upsertPlatformUser(userId: string, platform: string, platformId: string, displayName?: string, avatarUrl?: string): Promise<PlatformUser>;
  getUserByWallet(wallet: string): Promise<User | null>;
  getPlatformUser(platform: string, platformId: string): Promise<PlatformUser | null>;

  // Source Management
  upsertSource(platform: string, platformId: string, projectId: string, name?: string, description?: string, crawlConfig?: any): Promise<Source>;
  getSource(platform: string, platformId: string): Promise<Source | null>;
  updateSourceStatus(sourceId: string, isActive: boolean): Promise<Source>;

  // Message Management
  saveMessage(data: SaveMessageData): Promise<Message>;
  updateMessage(messageId: string, updates: UpdateMessageData): Promise<Message>;
  getMessageByExternalId(sourceId: string, externalId: string): Promise<Message | null>;
  getMessagesByAuthor(authorId: string, limit?: number, offset?: number): Promise<Message[]>;

  // Message Relations
  addMessageRelation(fromId: string, toId: string, kind: RelationKind): Promise<MessageRelation>;
  getMessageRelations(messageId: string, kind?: RelationKind): Promise<MessageRelation[]>;

  // Scoring
  saveScore(data: SaveScoreData): Promise<Score>;
  updateScore(scoreId: string, value: number, details?: any): Promise<Score>;
  getScoresByMessage(messageId: string): Promise<Score[]>;
  getScoresByUser(platformUserId: string, kind?: string): Promise<Score[]>;

  // Reactions
  addReaction(data: AddReactionData): Promise<Reaction>;
  removeReaction(messageId: string, platformUserId: string, kind: string): Promise<void>;
  getReactionsByMessage(messageId: string): Promise<Reaction[]>;

  // Platform-Specific Details
  saveDiscordMessageDetail(messageId: string, guildId?: string, channelId?: string, threadId?: string, embeds?: any, attachments?: any): Promise<DiscordMessageDetail>;

  // Ingest Management
  updateIngestCheckpoint(sourceId: string, checkpoint: IngestCheckpointData): Promise<IngestCheckpoint>;
  getIngestCheckpoint(sourceId: string): Promise<IngestCheckpoint | null>;
  recordIngestError(sourceId: string, error: string): Promise<IngestCheckpoint>;

  // Metrics & Snapshots
  saveMetricSnapshot(data: SaveMetricSnapshotData): Promise<MetricSnapshot>;
  getMetricSnapshots(messageId: string, startDate?: Date, endDate?: Date): Promise<MetricSnapshot[]>;

  // Campaign Management
  createCampaign(data: CampaignData): Promise<Campaign>;
  getCampaign(campaignId: string): Promise<Campaign | null>;
  getAllCampaigns(limit?: number, offset?: number): Promise<Campaign[]>;
  updateCampaign(campaignId: string, updates: Partial<CampaignData>): Promise<Campaign>;

  // Payout Management
  createPayout(data: PayoutData): Promise<Payout>;
  getPayout(payoutId: string): Promise<Payout | null>;
  getPayoutsByUser(userId: string, limit?: number, offset?: number): Promise<Payout[]>;
  getAllPayouts(limit?: number, offset?: number): Promise<Payout[]>;
  getPayoutsByCampaign(campaignId: string, limit?: number, offset?: number): Promise<Payout[]>;
  updatePayoutStatus(payoutId: string, status: PayoutStatus, txHash?: string, errorMessage?: string, processedById?: string): Promise<Payout>;

  // Event Persistence (Keep for audit trail)
  saveEventRaw(envelope: EventEnvelope<any>): Promise<void>;

  // Utility
  disconnect(): Promise<void>;
}

export class DatabasePersistenceService implements PersistenceService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  // User Management
  async upsertUser(wallet: string, displayName?: string): Promise<User> {
    return await this.prisma.user.upsert({
      where: { wallet },
      create: { wallet, displayName },
      update: { displayName }
    });
  }

  async upsertPlatformUser(userId: string, platform: string, platformId: string, displayName?: string, avatarUrl?: string): Promise<PlatformUser> {
    return await this.prisma.platformUser.upsert({
      where: { platform_platformId: { platform, platformId } },
      create: { userId, platform, platformId, displayName, avatarUrl },
      update: { displayName, avatarUrl }
    });
  }

  async getUserByWallet(wallet: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { wallet }
    });
  }

  async getPlatformUser(platform: string, platformId: string): Promise<PlatformUser | null> {
    return await this.prisma.platformUser.findUnique({
      where: { platform_platformId: { platform, platformId } }
    });
  }

  // Source Management
  async upsertSource(platform: string, platformId: string, projectId: string, name?: string, description?: string, crawlConfig?: any): Promise<Source> {
    return await this.prisma.source.upsert({
      where: { platform_platformId: { platform, platformId } },
      create: { platform, platformId, name, description, projectId, crawlConfig },
      update: { name, description, crawlConfig }
    });
  }

  async getSource(platform: string, platformId: string): Promise<Source | null> {
    return await this.prisma.source.findUnique({
      where: { platform_platformId: { platform, platformId } }
    });
  }

  async updateSourceStatus(sourceId: string, isActive: boolean): Promise<Source> {
    return await this.prisma.source.update({
      where: { id: sourceId },
      data: { isActive }
    });
  }

  // Message Management
  async saveMessage(data: SaveMessageData): Promise<Message> {
    return await this.prisma.message.create({
      data: {
        projectId: data.projectId,
        sourceId: data.sourceId,
        externalId: data.externalId,
        authorId: data.authorId,
        content: data.content,
        contentLang: data.contentLang
      }
    });
  }

  async updateMessage(messageId: string, updates: UpdateMessageData): Promise<Message> {
    return await this.prisma.message.update({
      where: { id: messageId },
      data: updates
    });
  }

  async getMessageByExternalId(sourceId: string, externalId: string): Promise<Message | null> {
    return await this.prisma.message.findUnique({
      where: { sourceId_externalId: { sourceId, externalId } }
    });
  }

  async getMessagesByAuthor(authorId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Message Relations
  async addMessageRelation(fromId: string, toId: string, kind: RelationKind): Promise<MessageRelation> {
    return await this.prisma.messageRelation.create({
      data: { fromId, toId, kind }
    });
  }

  async getMessageRelations(messageId: string, kind?: RelationKind): Promise<MessageRelation[]> {
    return await this.prisma.messageRelation.findMany({
      where: {
        OR: [
          { fromId: messageId },
          { toId: messageId }
        ],
        ...(kind && { kind })
      }
    });
  }

  // Scoring
  async saveScore(data: SaveScoreData): Promise<Score> {
    return await this.prisma.score.create({
      data: {
        messageId: data.messageId,
        platformUserId: data.platformUserId,
        kind: data.kind,
        value: data.value,
        details: data.details
      }
    });
  }

  async updateScore(scoreId: string, value: number, details?: any): Promise<Score> {
    return await this.prisma.score.update({
      where: { id: scoreId },
      data: { value, details }
    });
  }

  async getScoresByMessage(messageId: string): Promise<Score[]> {
    return await this.prisma.score.findMany({
      where: { messageId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getScoresByUser(platformUserId: string, kind?: string): Promise<Score[]> {
    return await this.prisma.score.findMany({
      where: {
        platformUserId,
        ...(kind && { kind })
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Reactions
  async addReaction(data: AddReactionData): Promise<Reaction> {
    return await this.prisma.reaction.upsert({
      where: {
        messageId_platformUserId_kind: {
          messageId: data.messageId,
          platformUserId: data.platformUserId,
          kind: data.kind
        }
      },
      create: {
        messageId: data.messageId,
        platformUserId: data.platformUserId,
        kind: data.kind,
        weight: data.weight
      },
      update: {
        weight: data.weight
      }
    });
  }

  async removeReaction(messageId: string, platformUserId: string, kind: string): Promise<void> {
    await this.prisma.reaction.deleteMany({
      where: { messageId, platformUserId, kind }
    });
  }

  async getReactionsByMessage(messageId: string): Promise<Reaction[]> {
    return await this.prisma.reaction.findMany({
      where: { messageId },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Platform-Specific Details
  async saveDiscordMessageDetail(messageId: string, guildId?: string, channelId?: string, threadId?: string, embeds?: any, attachments?: any): Promise<DiscordMessageDetail> {
    return await this.prisma.discordMessageDetail.upsert({
      where: { messageId },
      create: { messageId, guildId, channelId, threadId, embeds, attachments },
      update: { guildId, channelId, threadId, embeds, attachments }
    });
  }

  // Ingest Management
  async updateIngestCheckpoint(sourceId: string, checkpoint: IngestCheckpointData): Promise<IngestCheckpoint> {
    return await this.prisma.ingestCheckpoint.upsert({
      where: { sourceId },
      create: {
        sourceId,
        lastMessageId: checkpoint.lastMessageId,
        lastTimestamp: checkpoint.lastTimestamp,
        cursor: checkpoint.cursor,
        status: checkpoint.status || 'active'
      },
      update: {
        lastMessageId: checkpoint.lastMessageId,
        lastTimestamp: checkpoint.lastTimestamp,
        cursor: checkpoint.cursor,
        status: checkpoint.status,
        updatedAt: new Date()
      }
    });
  }

  async getIngestCheckpoint(sourceId: string): Promise<IngestCheckpoint | null> {
    return await this.prisma.ingestCheckpoint.findUnique({
      where: { sourceId }
    });
  }

  async recordIngestError(sourceId: string, error: string): Promise<IngestCheckpoint> {
    return await this.prisma.ingestCheckpoint.upsert({
      where: { sourceId },
      create: {
        sourceId,
        status: 'error',
        errorCount: 1,
        lastError: error,
        lastErrorAt: new Date()
      },
      update: {
        status: 'error',
        errorCount: { increment: 1 },
        lastError: error,
        lastErrorAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  // Metrics & Snapshots
  async saveMetricSnapshot(data: SaveMetricSnapshotData): Promise<MetricSnapshot> {
    return await this.prisma.metricSnapshot.create({
      data: {
        messageId: data.messageId,
        likeCount: data.likeCount,
        replyCount: data.replyCount,
        repostCount: data.repostCount,
        quoteCount: data.quoteCount,
        viewCount: data.viewCount,
        meta: data.meta
      }
    });
  }

  async getMetricSnapshots(messageId: string, startDate?: Date, endDate?: Date): Promise<MetricSnapshot[]> {
    return await this.prisma.metricSnapshot.findMany({
      where: {
        messageId,
        ...(startDate && endDate && {
          capturedAt: {
            gte: startDate,
            lte: endDate
          }
        })
      },
      orderBy: { capturedAt: 'desc' }
    });
  }

  // Campaign Management
  async createCampaign(data: CampaignData): Promise<Campaign> {
    return await this.prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        tokenSymbol: data.tokenSymbol,
        isNative: data.isNative,
        chainId: data.chainId,
        tokenAddress: data.tokenAddress,
        totalRewardPool: data.totalRewardPool,
        startDate: data.startDate,
        endDate: data.endDate,
        minScore: data.minScore,
        maxRewardsPerUser: data.maxRewardsPerUser,
        timeframe: data.timeframe,
        platforms: data.platforms,
        createdById: data.createdById
      }
    });
  }

  async getCampaign(campaignId: string): Promise<Campaign | null> {
    return await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { payouts: true }
    });
  }

  async getAllCampaigns(limit: number = 50, offset: number = 0): Promise<Campaign[]> {
    return await this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { payouts: true }
    });
  }

  async updateCampaign(campaignId: string, updates: Partial<CampaignData>): Promise<Campaign> {
    return await this.prisma.campaign.update({
      where: { id: campaignId },
      data: updates
    });
  }

  // Payout Management
  async createPayout(data: PayoutData): Promise<Payout> {
    return await this.prisma.payout.create({
      data: {
        platformUserId: data.platformUserId,
        userId: data.userId,
        campaignId: data.campaignId,
        amount: data.amount,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        processedById: data.processedById
      }
    });
  }

  async getPayout(payoutId: string): Promise<Payout | null> {
    return await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { campaign: true, user: true, platformUser: true }
    });
  }

  async getPayoutsByUser(userId: string, limit: number = 50, offset: number = 0): Promise<Payout[]> {
    return await this.prisma.payout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { campaign: true }
    });
  }

  async getAllPayouts(limit: number = 50, offset: number = 0): Promise<Payout[]> {
    return await this.prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { campaign: true, user: true, platformUser: true }
    });
  }

  async getPayoutsByCampaign(campaignId: string, limit: number = 50, offset: number = 0): Promise<Payout[]> {
    return await this.prisma.payout.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { user: true, platformUser: true }
    });
  }

  async updatePayoutStatus(payoutId: string, status: PayoutStatus, txHash?: string, errorMessage?: string, processedById?: string): Promise<Payout> {
    return await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status,
        txHash,
        errorMessage,
        processedById,
        payoutAt: status === 'COMPLETED' ? new Date() : undefined
      }
    });
  }

  // Event Persistence (Keep for audit trail)
  async saveEventRaw(envelope: EventEnvelope<any>): Promise<void> {
    try {
      await this.prisma.eventsRaw.create({
        data: {
          idempotencyKey: envelope.idempotencyKey,
          projectId: envelope.projectId,
          platform: envelope.platform,
          type: envelope.type,
          ts: new Date(envelope.ts),
          source: envelope.source,
          payload: envelope.payload,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violation (idempotency)
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        console.log(`[persistence] Event already exists: ${envelope.idempotencyKey}`);
        return;
      }
      throw error;
    }
  }

  // Utility
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Factory function for easy instantiation
export function createPersistenceService(prisma?: PrismaClient): PersistenceService {
  return new DatabasePersistenceService(prisma);
}