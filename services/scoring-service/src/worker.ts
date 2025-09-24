import { 
  xreadGroupLoop, 
  ingestStreamKey, 
  dlqStreamKey, 
  scoredStreamKey,
  xaddObj,
  type RedisLike 
} from '@ally/events/streams';
import { EventEnvelope } from '@ally/events/envelope';
import { createScoreOrchestrator } from '@ally/scoring-orchestrator';
import { createPersistenceService } from '@ally/db';
import { PlatformEventProcessor, WorkerConfig, WorkerStats } from './types.js';
import { DiscordEventProcessor, TelegramEventProcessor } from './processors/index.js';

export class ScoringWorker {
  private config: WorkerConfig;
  private stats: WorkerStats;
  private orchestrator: ReturnType<typeof createScoreOrchestrator>;
  private persistence: ReturnType<typeof createPersistenceService>;
  private abortController?: AbortController;
  private platformProcessors: PlatformEventProcessor[];

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
    
    // Initialize platform processors
    this.platformProcessors = [
      new DiscordEventProcessor(),
      // new TelegramEventProcessor(),
      // Add more platform processors here as needed
      // new TwitterEventProcessor(),
    ];
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
    // Check if any platform processor can handle this event
    return this.platformProcessors.some(processor => 
      processor.canHandle(envelope.platform, envelope.type)
    );
  }

  private async processEvent(envelope: EventEnvelope<any>): Promise<void> {
    // Find the appropriate platform processor
    const processor = this.platformProcessors.find(p => 
      p.canHandle(envelope.platform, envelope.type)
    );

    if (!processor) {
      throw new Error(`No processor found for platform: ${envelope.platform}, event: ${envelope.type}`);
    }

    // Process the event using the platform-specific processor
    await processor.processEvent(envelope, this.persistence, this.orchestrator);
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
