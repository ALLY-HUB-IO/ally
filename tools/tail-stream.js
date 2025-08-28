#!/usr/bin/env node

import { Redis } from 'ioredis';
import 'dotenv/config';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function parseStreamEntry(entry) {
  const [id, fields] = entry;
  return { id, fields };
}

function formatEvent(entry) {
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
  
  return `[${timestamp}] ${type} (${idempotencyKey})
${payload}
---`;
}

async function tailStream(streamKey, count = 10) {
  const redis = new Redis(REDIS_URL);
  
  try {
    console.log(`🔍 Connecting to Redis at ${REDIS_URL}`);
    await redis.ping();
    console.log(`✅ Redis connected`);
    
    console.log(`📊 Tailing stream: ${streamKey}`);
    console.log(`📈 Showing last ${count} entries + following new events...\n`);
    
    // Get last N entries
    const lastEntries = await redis.xrevrange(streamKey, '+', '-', 'COUNT', count);
    if (lastEntries.length > 0) {
      console.log('📜 Recent entries:');
      for (const entry of lastEntries.reverse()) {
        const parsed = parseStreamEntry(entry);
        console.log(formatEvent(parsed));
      }
      console.log('\n🔄 Following new events...\n');
    }
    
    // Get the last ID to start following from
    const lastId = lastEntries.length > 0 ? lastEntries[0][0] : '0';
    let currentId = lastId;
    
    // Follow new events
    while (true) {
      try {
        const newEntries = await redis.xread('BLOCK', 5000, 'STREAMS', streamKey, currentId);
        
        if (newEntries && newEntries.length > 0) {
          for (const stream of newEntries) {
            const [key, entries] = stream;
            for (const entry of entries) {
              const parsed = parseStreamEntry(entry);
              console.log(formatEvent(parsed));
              currentId = entry[0];
            }
          }
        }
      } catch (error) {
        console.error('❌ Error reading stream:', error);
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
const streamKey = args[0];
const count = args[1] ? parseInt(args[1], 10) : 10;

if (!streamKey) {
  console.log('Usage: node tools/tail-stream.js <streamKey> [count]');
  console.log('');
  console.log('Examples:');
  console.log('  node tools/tail-stream.js ally:my-first-project:platform.discord.message.created');
  console.log('  node tools/tail-stream.js ally:my-first-project:platform.discord.message.created 5');
  console.log('');
  console.log('Environment:');
  console.log('  REDIS_URL - Redis connection string (default: redis://localhost:6379)');
  process.exit(1);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Stopping stream tail...');
  process.exit(0);
});

tailStream(streamKey, count).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
