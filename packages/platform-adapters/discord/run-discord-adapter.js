#!/usr/bin/env node

import { startDiscordAdapter } from './dist/index.js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from infra folder
config({ path: resolve(process.cwd(), '../../../infra/.env'), override: true });

const token = process.env.DISCORD_BOT_TOKEN;
const projectId = process.env.PROJECT_ID || 'test-project';
const redisUrl = process.env.REDIS_URL?.replace('redis://redis:', 'redis://localhost:') || 'redis://localhost:6379';

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN is required');
  console.error('Please set DISCORD_BOT_TOKEN in your .env file');
  process.exit(1);
}

console.log('🤖 Starting Discord Adapter...');
console.log(`📊 Project ID: ${projectId}`);
console.log(`🔗 Redis URL: ${redisUrl}`);
console.log(`🎯 Bot Token: ${token.substring(0, 10)}...`);

const options = {
  token,
  projectId,
  redisUrl,
  includeBots: false
};

// Create a simple publisher that logs events
const publisher = {
  publish: async (event) => {
    console.log('📤 Published event:', event.type, event.payload.externalId);
  }
};

try {
  const client = startDiscordAdapter(options, publisher);
  console.log('✅ Discord Adapter connected successfully!');
  console.log('📝 Listening for Discord events...');
  console.log('💡 Try sending a message or reply in Discord to test!');
} catch (error) {
  console.error('❌ Failed to connect Discord Adapter:', error);
  process.exit(1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Discord Adapter...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Discord Adapter...');
  process.exit(0);
});
