import { PrismaClient } from '@prisma/client';
import type { EventEnvelope } from '@ally/events/envelope';
import type { CombinedScoringResult } from '@ally/scoring-orchestrator';

export interface PersistenceService {
  saveEventRaw(envelope: EventEnvelope<any>): Promise<void>;
  saveInteraction(
    externalId: string,
    platform: string,
    projectId: string,
    authorId: string | null,
    content: string,
    score: number,
    rationale: string
  ): Promise<void>;
  upsertInteraction(
    externalId: string,
    platform: string,
    projectId: string,
    authorId: string | null,
    content: string,
    score: number,
    rationale: string
  ): Promise<void>;
}

export class DatabasePersistenceService implements PersistenceService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

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

  async saveInteraction(
    externalId: string,
    platform: string,
    projectId: string,
    authorId: string | null,
    content: string,
    score: number,
    rationale: string
  ): Promise<void> {
    await this.prisma.interactions.create({
      data: {
        externalId,
        platform,
        projectId,
        authorId,
        content,
        score,
        rationale,
      },
    });
  }

  async upsertInteraction(
    externalId: string,
    platform: string,
    projectId: string,
    authorId: string | null,
    content: string,
    score: number,
    rationale: string
  ): Promise<void> {
    await this.prisma.interactions.upsert({
      where: {
        platform_externalId: {
          platform,
          externalId,
        },
      },
      update: {
        content,
        score,
        rationale,
        editedAt: new Date(),
      },
      create: {
        externalId,
        platform,
        projectId,
        authorId,
        content,
        score,
        rationale,
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Factory function for easy instantiation
export function createPersistenceService(prisma?: PrismaClient): PersistenceService {
  return new DatabasePersistenceService(prisma);
}
