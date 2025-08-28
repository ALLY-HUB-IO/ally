#!/usr/bin/env node

/**
 * Test script for DLQ requeue functionality
 * 
 * This script tests the requeue functionality by:
 * 1. Creating a test DLQ entry
 * 2. Running the requeue script in dry-run mode
 * 3. Verifying the requeue logic works correctly
 */

import Redis from 'ioredis';
import { spawn } from 'child_process';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PROJECT_ID = process.env.PROJECT_ID || 'test-project';

async function testRequeueFunctionality() {
  console.log('🧪 Testing DLQ requeue functionality...');
  
  const redis = new Redis(REDIS_URL);
  
  try {
    // Test connection
    await redis.ping();
    console.log('✅ Redis connected');

    const dlqStream = `ally:events:dlq:v1:${PROJECT_ID}`;
    
    // Create a test DLQ entry
    console.log('\n📝 Creating test DLQ entry...');
    const testDLQEntry = {
      error: 'Message content is required for scoring',
      raw: JSON.stringify({
        version: 'v1',
        idempotencyKey: 'test-requeue-key',
        projectId: PROJECT_ID,
        platform: 'discord',
        type: 'platform.discord.message.created',
        ts: new Date().toISOString(),
        source: '{}',
        payload: '{"externalId":"test-requeue","content":"This should be requeued"}'
      }),
      timestamp: new Date().toISOString(),
      streamId: 'test-stream-id',
      streamKey: `ally:events:ingest:v1:${PROJECT_ID}:discord`,
      consumerGroup: 'cg:scoring:v1:test-project',
      consumerName: 'test-consumer'
    };

    const dlqId = await redis.xadd(dlqStream, '*', ...Object.entries(testDLQEntry).flat());
    console.log(`✅ Created test DLQ entry: ${dlqId}`);

    // Test 1: Dry run with error pattern
    console.log('\n🔍 Test 1: Dry run with error pattern...');
    await runRequeueScript([PROJECT_ID, '--error-pattern', 'content is required', '--dry-run']);

    // Test 2: Dry run with specific entry ID
    console.log('\n🔍 Test 2: Dry run with specific entry ID...');
    await runRequeueScript([PROJECT_ID, '--entry-id', dlqId, '--dry-run']);

    // Test 3: Actually requeue the entry
    console.log('\n🔄 Test 3: Actually requeuing the entry...');
    await runRequeueScript([PROJECT_ID, '--entry-id', dlqId]);

    // Verify the entry was moved
    console.log('\n📊 Verifying requeue...');
    const remainingEntries = await redis.xrevrange(dlqStream, '+', '-', 'COUNT', 5);
    const entryStillExists = remainingEntries.some(([id]) => id === dlqId);
    
    if (entryStillExists) {
      console.log('❌ Entry still exists in DLQ - requeue may have failed');
    } else {
      console.log('✅ Entry successfully removed from DLQ');
    }

    // Check if it was added to the original stream
    const originalStream = `ally:events:ingest:v1:${PROJECT_ID}:discord`;
    const streamEntries = await redis.xrevrange(originalStream, '+', '-', 'COUNT', 5);
    const requeuedEntry = streamEntries.find(([id, fields]) => {
      const idempotencyKeyIndex = fields.findIndex(f => f === 'idempotencyKey');
      return idempotencyKeyIndex >= 0 && fields[idempotencyKeyIndex + 1] === 'test-requeue-key';
    });

    if (requeuedEntry) {
      console.log('✅ Entry successfully added to original stream');
    } else {
      console.log('❌ Entry not found in original stream');
    }

    console.log('\n✅ Requeue functionality test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await redis.quit();
  }
}

function runRequeueScript(args) {
  return new Promise((resolve, reject) => {
    console.log(`   Running: node tools/requeue-dlq.js ${args.join(' ')}`);
    
    const child = spawn('node', ['tools/requeue-dlq.js', ...args], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Requeue script failed with code ${code}: ${errorOutput}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

testRequeueFunctionality().catch(console.error);
