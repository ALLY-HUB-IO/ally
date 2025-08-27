#!/usr/bin/env node

import { Redis } from 'ioredis';
import 'dotenv/config';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function parseStreamEntry(entry) {
  const [id, fields] = entry;
  return { id, fields };
}

function formatEvent(streamKey, entry) {
  const fields = {};
  
  // Convert fields array to object
  for (let i = 0; i < entry.fields.length; i += 2) {
    fields[entry.fields[i]] = entry.fields[i + 1];
  }
  
  const timestamp = new Date().toISOString();
  const type = fields.type || 'unknown';
  const idempotencyKey = fields.idempotencyKey || 'unknown';
  
  let payload = '{}';
  try {
    if (fields.payload) {
      const parsed = JSON.parse(fields.payload);
      payload = JSON.stringify(parsed, null, 2);
    }
  } catch (e) {
    payload = fields.payload || '{}';
  }
  
  // Color code different event types
  const eventType = type.split('.').pop();
  let colorPrefix = '';
  switch (eventType) {
    case 'created':
      colorPrefix = '📝';
      break;
    case 'updated':
      colorPrefix = '✏️';
      break;
    case 'added':
      colorPrefix = '➕';
      break;
    case 'removed':
      colorPrefix = '➖';
      break;
    default:
      colorPrefix = '📝';
  }
  
  return `[${timestamp}] ${colorPrefix} ${type} (${idempotencyKey})
📊 Stream: ${streamKey}
${payload}
---`;
}

async function tailAllDiscordEvents(projectId, count = 5) {
  const redis = new Redis(REDIS_URL);
  
  try {
    console.log(`🔍 Connecting to Redis at ${REDIS_URL}`);
    await redis.ping();
    console.log(`✅ Redis connected`);
    
    // Define all Discord event streams
    const streamKeys = [
      `ally:${projectId}:platform.discord.message.created`,
      `ally:${projectId}:platform.discord.message.updated`,
      `ally:${projectId}:platform.discord.reaction.added`,
      `ally:${projectId}:platform.discord.reaction.removed`
    ];
    
    console.log(`📊 Tailing all Discord events for project: ${projectId}`);
    console.log(`📈 Showing last ${count} entries per stream + following new events...\n`);
    
    // Get last N entries from each stream
    const streamStates = {};
    
    for (const streamKey of streamKeys) {
      console.log(`📜 Recent entries from ${streamKey}:`);
      const lastEntries = await redis.xrevrange(streamKey, '+', '-', 'COUNT', count);
      
      if (lastEntries.length > 0) {
        for (const entry of lastEntries.reverse()) {
          const parsed = parseStreamEntry(entry);
          console.log(formatEvent(streamKey, parsed));
        }
        streamStates[streamKey] = lastEntries[0][0]; // Last ID
      } else {
        streamStates[streamKey] = '0'; // Start from beginning
      }
      console.log('');
    }
    
    console.log('🔄 Following new events from all streams...\n');
    
    // Follow new events from all streams
    while (true) {
      try {
        // Prepare streams and IDs for xread
        const streams = [];
        const ids = [];
        for (const streamKey of streamKeys) {
          streams.push(streamKey);
          ids.push(streamStates[streamKey]);
        }
        
        const newEntries = await redis.xread('BLOCK', 5000, 'STREAMS', ...streams, ...ids);
        
        if (newEntries && newEntries.length > 0) {
          for (const stream of newEntries) {
            const [streamKey, entries] = stream;
            for (const entry of entries) {
              const parsed = parseStreamEntry(entry);
              console.log(formatEvent(streamKey, parsed));
              streamStates[streamKey] = entry[0]; // Update last ID
            }
          }
        }
      } catch (error) {
        console.error('❌ Error reading streams:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    process.exit(1);
  }
}

// CLI argument parsing
const args = process.argv.slice(2);
const projectId = args[0];
const count = args[1] ? parseInt(args[1], 10) : 5;

if (!projectId) {
  console.log('Usage: node tools/tail-all-discord.js <projectId> [count]');
  console.log('');
  console.log('Examples:');
  console.log('  node tools/tail-all-discord.js my-first-project');
  console.log('  node tools/tail-all-discord.js my-first-project 10');
  console.log('');
  console.log('This will follow all Discord events:');
  console.log('  - Message created events');
  console.log('  - Message updated events');
  console.log('  - Reaction added events');
  console.log('  - Reaction removed events');
  console.log('');
  console.log('Environment:');
  console.log('  REDIS_URL - Redis connection string (default: redis://localhost:6379)');
  process.exit(1);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Stopping all Discord event streams...');
  process.exit(0);
});

tailAllDiscordEvents(projectId, count).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
