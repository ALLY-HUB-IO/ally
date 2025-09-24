#!/usr/bin/env node

// Simple integration test for the scoring worker
// Run with: node tests/integration.test.js

import Redis from 'ioredis';
import { ingestStreamKey, xaddObj } from '@ally/events/streams';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PROJECT_ID = process.env.PROJECT_ID || 'test-project';

async function runIntegrationTest() {
  console.log('🧪 Running integration test for scoring worker...');
  
  const redis = new Redis(REDIS_URL);
  
  try {
    // Test connection
    await redis.ping();
    console.log('✅ Redis connected');
    
    // Test 1: Publish a valid Discord message
    console.log('\n📝 Test 1: Publishing valid Discord message...');
    const validMessage = {
      version: 'v1',
      idempotencyKey: `test-valid-${Date.now()}`,
      projectId: PROJECT_ID,
      platform: 'discord',
      type: 'platform.discord.message.created',
      ts: new Date().toISOString(),
      source: JSON.stringify({
        guildId: 'test-guild',
        channelId: 'test-channel'
      }),
      payload: JSON.stringify({
        externalId: 'test-message-valid',
        content: 'This is a valid test message for scoring!',
        author: {
          id: 'test-user',
          username: 'testuser',
          displayName: 'Test User'
        },
        channelId: 'test-channel',
        guildId: 'test-guild',
        createdAt: new Date().toISOString()
      })
    };
    
    const stream = ingestStreamKey(PROJECT_ID, 'discord');
    const messageId = await xaddObj(redis, stream, validMessage, {
      maxLen: { strategy: 'approx', count: 1000 }
    });
    
    console.log(`✅ Published valid message: ${messageId}`);
    
    // Test 2: Publish a Discord message update (should be processed now)
    console.log('\n📝 Test 2: Publishing Discord message update...');
    const updateMessage = {
      version: 'v1',
      idempotencyKey: `test-update-${Date.now()}`,
      projectId: PROJECT_ID,
      platform: 'discord',
      type: 'platform.discord.message.updated',
      ts: new Date().toISOString(),
      source: JSON.stringify({
        guildId: 'test-guild',
        channelId: 'test-channel'
      }),
      payload: JSON.stringify({
        externalId: 'test-message-update',
        content: 'This is an updated message for scoring!',
        author: {
          id: 'test-user',
          username: 'testuser',
          displayName: 'Test User'
        },
        channelId: 'test-channel',
        guildId: 'test-guild',
        editedAt: new Date().toISOString()
      })
    };
    
    const updateId = await xaddObj(redis, stream, updateMessage, {
      maxLen: { strategy: 'approx', count: 1000 }
    });
    
    console.log(`✅ Published update message: ${updateId}`);
    
    // Test 3: Publish a malformed message (missing content)
    console.log('\n📝 Test 3: Publishing malformed message...');
    const malformedMessage = {
      version: 'v1',
      idempotencyKey: `test-malformed-${Date.now()}`,
      projectId: PROJECT_ID,
      platform: 'discord',
      type: 'platform.discord.message.created',
      ts: new Date().toISOString(),
      source: JSON.stringify({
        guildId: 'test-guild',
        channelId: 'test-channel'
      }),
      payload: JSON.stringify({
        externalId: 'test-message-malformed',
        author: {
          id: 'test-user',
          username: 'testuser'
        },
        channelId: 'test-channel',
        guildId: 'test-guild'
        // Missing content - should cause error and land in DLQ
      })
    };
    
    const malformedId = await xaddObj(redis, stream, malformedMessage, {
      maxLen: { strategy: 'approx', count: 1000 }
    });
    
    console.log(`✅ Published malformed message: ${malformedId}`);
    
    // Test 4: Publish a Discord reaction event
    console.log('\n📝 Test 4: Publishing Discord reaction event...');
    const reactionMessage = {
      version: 'v1',
      idempotencyKey: `test-reaction-${Date.now()}`,
      projectId: PROJECT_ID,
      platform: 'discord',
      type: 'platform.discord.reaction.added',
      ts: new Date().toISOString(),
      source: JSON.stringify({
        guildId: 'test-guild',
        channelId: 'test-channel'
      }),
      payload: JSON.stringify({
        externalId: 'test-reaction-123',
        messageId: 'test-message-valid',
        author: {
          id: 'test-user-2',
          username: 'testuser2',
          displayName: 'Test User 2'
        },
        emoji: {
          name: '👍',
          id: null
        },
        channelId: 'test-channel',
        guildId: 'test-guild',
        createdAt: new Date().toISOString()
      })
    };
    
    const reactionId = await xaddObj(redis, stream, reactionMessage, {
      maxLen: { strategy: 'approx', count: 1000 }
    });
    
    console.log(`✅ Published reaction message: ${reactionId}`);
    
    // Test 5: Publish an unsupported platform event
    console.log('\n📝 Test 5: Publishing unsupported platform event...');
    const unsupportedPlatformMessage = {
      version: 'v1',
      idempotencyKey: `test-unsupported-platform-${Date.now()}`,
      projectId: PROJECT_ID,
      platform: 'twitter', // Unsupported platform
      type: 'platform.twitter.tweet.created',
      ts: new Date().toISOString(),
      source: JSON.stringify({}),
      payload: JSON.stringify({
        externalId: 'test-tweet-123',
        content: 'This should be ignored - unsupported platform'
      })
    };
    
    const unsupportedPlatformId = await xaddObj(redis, stream, unsupportedPlatformMessage, {
      maxLen: { strategy: 'approx', count: 1000 }
    });
    
    console.log(`✅ Published unsupported platform message: ${unsupportedPlatformId}`);
    
    // Wait for processing
    console.log('\n⏳ Waiting 10 seconds for worker to process messages...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check results
    console.log('\n📊 Checking results...');
    
    // Check DLQ for errors
    const dlqStream = `ally:events:dlq:v1:${PROJECT_ID}`;
    const dlqEntries = await redis.xrevrange(dlqStream, '+', '-', 'COUNT', 10);
    
    if (dlqEntries.length > 0) {
      console.log('⚠️  Found entries in DLQ:');
      for (const [id, fields] of dlqEntries) {
        const errorIndex = fields.findIndex(f => f === 'error');
        const error = errorIndex >= 0 ? fields[errorIndex + 1] : 'Unknown error';
        console.log(`   ${id}: ${error}`);
      }
    } else {
      console.log('✅ No entries in DLQ');
    }
    
    // Check scored stream
    const scoredStream = `ally:events:scored:v1:${PROJECT_ID}`;
    const scoredEntries = await redis.xrevrange(scoredStream, '+', '-', 'COUNT', 10);
    
    if (scoredEntries.length > 0) {
      console.log('✅ Found scored entries:');
      for (const [id, fields] of scoredEntries) {
        console.log(`   ${id}: ${fields.join(' ')}`);
      }
    } else {
      console.log('ℹ️  No scored entries yet (expected if worker not running)');
    }
    
    // Check consumer group info
    console.log('\n📈 Consumer group info:');
    try {
      const groupInfo = await redis.xinfo('GROUPS', stream);
      console.log('Consumer groups:', groupInfo);
      
      if (groupInfo.length > 0) {
        const groupName = groupInfo[0][1]; // First group name
        const consumers = await redis.xinfo('CONSUMERS', stream, groupName);
        console.log('Consumers:', consumers);
      }
    } catch (error) {
      console.log('No consumer groups found yet');
    }
    
    console.log('\n✅ Integration test completed!');
    console.log('\n💡 To see real-time processing, start the scoring service:');
    console.log('   npm run dev');
    console.log('   # or');
    console.log('   docker compose up scoring-service');
    
    // Test requeue functionality if there are DLQ entries
    if (dlqEntries.length > 0) {
      console.log('\n🔄 Testing requeue functionality...');
      console.log('   To requeue DLQ entries, run:');
      console.log(`   node tools/requeue-dlq.ts ${PROJECT_ID} --dry-run`);
      console.log(`   node tools/requeue-dlq.ts ${PROJECT_ID} --error-pattern "content is required"`);
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  } finally {
    await redis.quit();
  }
}

runIntegrationTest().catch(console.error);
