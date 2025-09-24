import { PrismaClient } from '@prisma/client';

let prismaSingleton: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

export type { 
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
  Admin,
  SystemConfig,
  EventsRaw,
  PayoutStatus,
  RelationKind
} from '@prisma/client';

// Persistence service exports
export { 
  createPersistenceService, 
  DatabasePersistenceService,
  type PersistenceService,
  type SaveMessageData,
  type UpdateMessageData,
  type SaveScoreData,
  type AddReactionData,
  type IngestCheckpointData,
  type SaveMetricSnapshotData,
  type CampaignData,
  type PayoutData
} from './persistence.js';


