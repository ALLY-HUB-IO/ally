import Redis from 'ioredis';
import { 
  xreadGroupLoop, 
  ingestStreamKey, 
  dlqStreamKey, 
  scoredStreamKey,
  xaddObj,
  type RedisLike 
} from '@ally/events/streams';
import { EventEnvelope } from '@ally/events/envelope';
import { EventType } from '@ally/events/catalog';
import { createScoreOrchestrator } from '@ally/scoring-orchestrator';
import { createPersistenceService } from '@ally/db';

export interface WorkerConfig {
  redis: RedisLike;
  projectId: string;
  platform: string;
  consumerGroup: string;
  consumerName: string;
  count?: number;
  blockMs?: number;
}

export interface WorkerStats {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  messagesIgnored: number;
  lastProcessedAt?: Date;
}

export class ScoringWorker {
  private config: WorkerConfig;
  private stats: WorkerStats;
  private orchestrator: ReturnType<typeof createScoreOrchestrator>;
  private persistence: ReturnType<typeof createPersistenceService>;
  private abortController?: AbortController;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.stats = {
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
      messagesIgnored: 0,
    };
    this.orchestrator = createScoreOrchestrator();
    this.persistence = createPersistenceService();
  }

  async start(): Promise<void> {
    console.log(`[worker] Starting scoring worker for project ${this.config.projectId}`);
    
    const stream = ingestStreamKey(this.config.projectId, this.config.platform);
    const group = this.config.consumerGroup;
    const consumer = this.config.consumerName;

    // Ensure consumer group exists
    if (this.config.redis.xgroup) {
      try {
        await this.config.redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
        console.log(`[worker] Created consumer group ${group} on stream ${stream}`);
      } catch (error: any) {
        if (error.message?.includes('BUSYGROUP')) {
          console.log(`[worker] Consumer group ${group} already exists on stream ${stream}`);
        } else {
          throw error;
        }
      }
    }

    this.abortController = new AbortController();

    // Start the consumer loop
    await xreadGroupLoop(this.config.redis, {
      group,
      consumer,
      streams: [stream],
      count: this.config.count ?? 50,
      blockMs: this.config.blockMs ?? 5000,
      autoAck: false, // We'll manually ack after processing
      abortSignal: this.abortController.signal,
      handler: async ({ stream: streamKey, id, fields }: { stream: string; id: string; fields: Record<string, string> }) => {
        await this.handleMessage(streamKey, id, fields);
      },
    });
  }

  async stop(): Promise<void> {
    console.log('[worker] Stopping scoring worker...');
    this.abortController?.abort();
  }

  getStats(): WorkerStats {
    return { ...this.stats };
  }

  private async handleMessage(streamKey: string, id: string, fields: Record<string, string>): Promise<void> {
    this.stats.messagesReceived++;
    this.stats.lastProcessedAt = new Date();

    try {
      // Parse the event envelope
      const envelope: EventEnvelope<any> = {
        version: fields.version,
        idempotencyKey: fields.idempotencyKey,
        projectId: fields.projectId,
        platform: fields.platform as any,
        type: fields.type,
        ts: fields.ts,
        source: JSON.parse(fields.source || '{}'),
        payload: JSON.parse(fields.payload || '{}'),
      };

      // Save raw event to database for audit trail
      await this.persistence.saveEventRaw(envelope);

      // Route by event type
      const shouldProcess = this.shouldProcessEvent(envelope);
      if (!shouldProcess) {
        this.stats.messagesIgnored++;
        console.log(`[worker] Ignoring unsupported event type: ${envelope.type}`);
        await this.acknowledgeMessage(streamKey, id);
        return;
      }

      // Process the event
      await this.processEvent(envelope);
      this.stats.messagesProcessed++;

      // Acknowledge successful processing
      await this.acknowledgeMessage(streamKey, id);

    } catch (error) {
      this.stats.messagesFailed++;
      console.error(`[worker] Failed to process message ${id}:`, error);
      
      // Send to DLQ
      await this.sendToDLQ(streamKey, id, fields, error as Error);
      
      // Still acknowledge to prevent infinite retries
      await this.acknowledgeMessage(streamKey, id);
    }
  }

  private shouldProcessEvent(envelope: EventEnvelope<any>): boolean {
    // Only process message creation events for now
    // Can be extended to handle updates, deletions, reactions, etc.
    return envelope.type === EventType.DISCORD_MESSAGE_CREATED;
  }

  private async processEvent(envelope: EventEnvelope<any>): Promise<void> {
    const { payload } = envelope;
    
    if (!payload.content || typeof payload.content !== 'string') {
      throw new Error('Message content is required for scoring');
    }

    // Score the message using the orchestrator
    const result = await this.orchestrator.score({
      text: payload.content,
      projectId: process.env.TEC_CHAT_ID || envelope.projectId,
      context: {
        messageId: payload.externalId,
        authorId: payload.author?.id,
        timestamp: envelope.ts,
      },
    });

    console.log(`[worker] Scored message ${payload.externalId}: ${result.finalScore.toFixed(3)}`);

    // Save interaction to database
    await this.persistence.upsertInteraction(
      payload.externalId,
      envelope.platform,
      envelope.projectId,
      payload.author?.id || null,
      payload.content,
      result.finalScore,
      `Score: ${result.finalScore.toFixed(3)}, Sentiment: ${result.breakdown.sentiment.label}, Processing time: ${result.metadata.processingTimeMs}ms`
    );

    // Publish scored event to scored stream
    const scoredStream = scoredStreamKey(envelope.projectId);
    const scoredEvent = {
      version: 'v1',
      idempotencyKey: `scored-${envelope.idempotencyKey}`,
      projectId: envelope.projectId,
      platform: envelope.platform,
      type: 'platform.scored.message',
      ts: new Date().toISOString(),
      source: JSON.stringify({
        originalEventId: envelope.idempotencyKey,
        originalType: envelope.type,
        scoringService: 'scoring-service',
      }),
      payload: JSON.stringify({
        externalId: payload.externalId,
        authorId: payload.author?.id,
        content: payload.content,
        score: result.finalScore,
        breakdown: result.breakdown,
        metadata: result.metadata,
        originalEvent: envelope,
      }),
    };

    await xaddObj(this.config.redis, scoredStream, scoredEvent, {
      maxLen: { strategy: 'approx', count: 10000 }
    });

    console.log(`[worker] Published scored event to ${scoredStream}: ${result.finalScore.toFixed(3)}`);
  }

  private async acknowledgeMessage(streamKey: string, id: string): Promise<void> {
    try {
      await this.config.redis.xack(streamKey, this.config.consumerGroup, id);
    } catch (error) {
      console.error(`[worker] Failed to acknowledge message ${id}:`, error);
    }
  }

  private async sendToDLQ(streamKey: string, id: string, fields: Record<string, string>, error: Error): Promise<void> {
    try {
      const dlqStream = dlqStreamKey(this.config.projectId);
      const dlqEntry = {
        error: error.message,
        raw: JSON.stringify(fields),
        timestamp: new Date().toISOString(),
        streamId: id,
        streamKey: streamKey,
        consumerGroup: this.config.consumerGroup,
        consumerName: this.config.consumerName,
      };

      await xaddObj(this.config.redis, dlqStream, dlqEntry, {
        maxLen: { strategy: 'approx', count: 10000 }
      });

      console.log(`[worker] Sent message ${id} to DLQ: ${error.message}`);
    } catch (dlqError) {
      console.error(`[worker] Failed to send message ${id} to DLQ:`, dlqError);
    }
  }
}
