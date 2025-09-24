import { EventEnvelope } from '@ally/events/envelope';

// Platform-specific event processors
export interface PlatformEventProcessor {
  canHandle(platform: string, eventType: string): boolean;
  processEvent(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void>;
}

// Message context types
export enum MessageContext {
  COMMENT = 'comment',
  REPLY = 'reply', 
  THREAD_ANSWER = 'thread_answer',
  DM = 'dm',
  THREAD_START = 'thread_start'
}

// Worker configuration
export interface WorkerConfig {
  redis: any; // RedisLike type
  projectId: string;
  platform: string;
  consumerGroup: string;
  consumerName: string;
  count?: number;
  blockMs?: number;
}

// Worker statistics
export interface WorkerStats {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  messagesIgnored: number;
  lastProcessedAt?: Date;
}
