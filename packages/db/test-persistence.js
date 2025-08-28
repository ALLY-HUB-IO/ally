#!/usr/bin/env node

/**
 * Test script for database persistence functionality
 * 
 * This script tests the persistence service by:
 * 1. Creating test events and interactions
 * 2. Verifying upsert functionality
 * 3. Testing idempotency
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPersistence() {
  console.log('🧪 Testing database persistence functionality...');
  
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected');

    const testProjectId = 'test-project';
    const testPlatform = 'discord';
    const testExternalId = 'test-message-123';

    // Test 1: Save event raw
    console.log('\n📝 Test 1: Saving event raw...');
    const testEvent = {
      idempotencyKey: `test-event-${Date.now()}`,
      projectId: testProjectId,
      platform: testPlatform,
      type: 'platform.discord.message.created',
      ts: new Date().toISOString(),
      source: { guildId: 'test-guild', channelId: 'test-channel' },
      payload: {
        externalId: testExternalId,
        content: 'Test message content',
        author: { id: 'test-user', username: 'testuser' },
        createdAt: new Date().toISOString()
      }
    };

    await prisma.eventsRaw.create({
      data: {
        idempotencyKey: testEvent.idempotencyKey,
        projectId: testEvent.projectId,
        platform: testEvent.platform,
        type: testEvent.type,
        ts: new Date(testEvent.ts),
        source: testEvent.source,
        payload: testEvent.payload,
      },
    });
    console.log('✅ Event raw saved successfully');

    // Test 2: Save interaction
    console.log('\n📝 Test 2: Saving interaction...');
    const testInteraction = {
      externalId: testExternalId,
      platform: testPlatform,
      projectId: testProjectId,
      authorId: 'test-user',
      content: 'Test message content',
      score: 0.75,
      rationale: 'Test rationale for scoring'
    };

    await prisma.interactions.create({
      data: testInteraction,
    });
    console.log('✅ Interaction saved successfully');

    // Test 3: Upsert interaction (should update)
    console.log('\n📝 Test 3: Testing upsert interaction...');
    const updatedInteraction = {
      ...testInteraction,
      content: 'Updated test message content',
      score: 0.85,
      rationale: 'Updated rationale for scoring'
    };

    await prisma.interactions.upsert({
      where: {
        platform_externalId: {
          platform: testPlatform,
          externalId: testExternalId,
        },
      },
      update: {
        content: updatedInteraction.content,
        score: updatedInteraction.score,
        rationale: updatedInteraction.rationale,
        editedAt: new Date(),
      },
      create: updatedInteraction,
    });
    console.log('✅ Interaction upserted successfully');

    // Test 4: Verify idempotency (duplicate event should be ignored)
    console.log('\n📝 Test 4: Testing idempotency...');
    try {
      await prisma.eventsRaw.create({
        data: {
          idempotencyKey: testEvent.idempotencyKey, // Same key
          projectId: testEvent.projectId,
          platform: testEvent.platform,
          type: testEvent.type,
          ts: new Date(testEvent.ts),
          source: testEvent.source,
          payload: testEvent.payload,
        },
      });
      console.log('❌ Idempotency test failed - duplicate was created');
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
        console.log('✅ Idempotency test passed - duplicate was rejected');
      } else {
        throw error;
      }
    }

    // Test 5: Query and verify data
    console.log('\n📝 Test 5: Querying saved data...');
    const savedEvent = await prisma.eventsRaw.findUnique({
      where: { idempotencyKey: testEvent.idempotencyKey }
    });
    
    const savedInteraction = await prisma.interactions.findUnique({
      where: { 
        platform_externalId: {
          platform: testPlatform,
          externalId: testExternalId,
        }
      }
    });

    if (savedEvent) {
      console.log('✅ Event raw found:', {
        id: savedEvent.id,
        type: savedEvent.type,
        projectId: savedEvent.projectId
      });
    } else {
      console.log('❌ Event raw not found');
    }

    if (savedInteraction) {
      console.log('✅ Interaction found:', {
        id: savedInteraction.id,
        score: savedInteraction.score,
        content: savedInteraction.content.substring(0, 20) + '...'
      });
    } else {
      console.log('❌ Interaction not found');
    }

    // Test 6: Query by project
    console.log('\n📝 Test 6: Querying by project...');
    const projectEvents = await prisma.eventsRaw.findMany({
      where: { projectId: testProjectId },
      take: 5
    });

    const projectInteractions = await prisma.interactions.findMany({
      where: { projectId: testProjectId },
      take: 5
    });

    console.log(`✅ Found ${projectEvents.length} events for project`);
    console.log(`✅ Found ${projectInteractions.length} interactions for project`);

    console.log('\n✅ All persistence tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPersistence().catch(console.error);
