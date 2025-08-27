import 'dotenv/config';
import { Redis } from 'ioredis';
import { startDiscordAdapter, type Publisher } from '@ally/platform-adapter-discord';
import type { EventEnvelope } from '@ally/events/envelope';

const REDIS_URL = process.env.REDIS_URL;
const PROJECT_ID = process.env.PROJECT_ID || 'default-project';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_ALLOWED_GUILDS = process.env.DISCORD_ALLOWED_GUILDS?.split(',').map(s => s.trim()) || [];
const DISCORD_ALLOWED_CHANNELS = process.env.DISCORD_ALLOWED_CHANNELS?.split(',').map(s => s.trim()) || [];
const DISCORD_INCLUDE_BOTS = process.env.DISCORD_INCLUDE_BOTS === 'true';
const DISCORD_MIN_MESSAGE_LENGTH = parseInt(process.env.DISCORD_MIN_MESSAGE_LENGTH || '1', 10);

if (!REDIS_URL) {
  console.error('[ingestion-service] REDIS_URL is required');
  process.exit(1);
}

if (!DISCORD_BOT_TOKEN) {
  console.error('[ingestion-service] DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

const redis = new Redis(REDIS_URL);

// Stats tracking
let stats = {
  messagesReceived: 0,
  messagesPublished: 0,
  messagesFiltered: 0,
  errors: 0,
  startTime: new Date()
};

// Build Redis stream key
function buildStreamKey(eventType: string): string {
  return `ally:${PROJECT_ID}:${eventType}`;
}

// Filter messages based on configuration
function shouldProcessMessage(envelope: EventEnvelope<any>): boolean {
  const payload = envelope.payload;
  
  // Check minimum message length
  if (payload.content && payload.content.length < DISCORD_MIN_MESSAGE_LENGTH) {
    return false;
  }
  
  // Check guild allowlist
  if (DISCORD_ALLOWED_GUILDS.length > 0 && payload.guildId) {
    if (!DISCORD_ALLOWED_GUILDS.includes(payload.guildId)) {
      return false;
    }
  }
  
  // Check channel allowlist
  if (DISCORD_ALLOWED_CHANNELS.length > 0) {
    if (!DISCORD_ALLOWED_CHANNELS.includes(payload.channelId)) {
      return false;
    }
  }
  
  // Check bot messages (unless explicitly enabled)
  if (!DISCORD_INCLUDE_BOTS && payload.author?.isBot) {
    return false;
  }
  
  return true;
}

// Redis Publisher implementation
const redisPublisher: Publisher = {
  publish: async (envelope: EventEnvelope<any>) => {
    stats.messagesReceived++;
    
    try {
      // Apply filters
      if (!shouldProcessMessage(envelope)) {
        stats.messagesFiltered++;
        return;
      }
      
      // Build stream key
      const streamKey = buildStreamKey(envelope.type);
      
      // Publish to Redis stream with MAXLEN ~100000
      await redis.xadd(
        streamKey,
        'MAXLEN', '~', '100000',
        '*',
        'version', envelope.version,
        'idempotencyKey', envelope.idempotencyKey,
        'projectId', envelope.projectId,
        'platform', envelope.platform,
        'type', envelope.type,
        'ts', envelope.ts,
        'source', JSON.stringify(envelope.source),
        'payload', JSON.stringify(envelope.payload)
      );
      
      stats.messagesPublished++;
      
      // Log every 100 messages
      if (stats.messagesPublished % 100 === 0) {
        console.log(`[ingestion-service] Stats: received=${stats.messagesReceived}, published=${stats.messagesPublished}, filtered=${stats.messagesFiltered}, errors=${stats.errors}`);
      }
      
    } catch (error) {
      stats.errors++;
      console.error('[ingestion-service] Failed to publish event:', error);
    }
  }
};

// Health check function
async function healthCheck(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('[ingestion-service] Health check failed:', error);
    return false;
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('[ingestion-service] Shutting down...');
  console.log(`[ingestion-service] Final stats: received=${stats.messagesReceived}, published=${stats.messagesPublished}, filtered=${stats.messagesFiltered}, errors=${stats.errors}`);
  await redis.quit();
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the service
async function start() {
  console.log('[ingestion-service] Starting...');
  console.log(`[ingestion-service] Project ID: ${PROJECT_ID}`);
  console.log(`[ingestion-service] Allowed guilds: ${DISCORD_ALLOWED_GUILDS.length > 0 ? DISCORD_ALLOWED_GUILDS.join(', ') : 'all'}`);
  console.log(`[ingestion-service] Allowed channels: ${DISCORD_ALLOWED_CHANNELS.length > 0 ? DISCORD_ALLOWED_CHANNELS.join(', ') : 'all'}`);
  console.log(`[ingestion-service] Include bots: ${DISCORD_INCLUDE_BOTS}`);
  console.log(`[ingestion-service] Min message length: ${DISCORD_MIN_MESSAGE_LENGTH}`);
  
  // Health check
  if (!(await healthCheck())) {
    console.error('[ingestion-service] Redis connection failed');
    process.exit(1);
  }
  
  try {
    // Start Discord adapter
    const client = startDiscordAdapter(
      {
        projectId: PROJECT_ID,
        token: DISCORD_BOT_TOKEN,
        includeBots: DISCORD_INCLUDE_BOTS
      },
      redisPublisher
    );
    
    console.log('[ingestion-service] Discord adapter started successfully');
    
    // Log stats periodically
    setInterval(() => {
      const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
      console.log(`[ingestion-service] Uptime: ${uptime}s, Stats: received=${stats.messagesReceived}, published=${stats.messagesPublished}, filtered=${stats.messagesFiltered}, errors=${stats.errors}`);
    }, 30000); // Every 30 seconds
    
  } catch (error) {
    console.error('[ingestion-service] Failed to start Discord adapter:', error);
    process.exit(1);
  }
}

start().catch((error) => {
  console.error('[ingestion-service] Startup failed:', error);
  process.exit(1);
});
