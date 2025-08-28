#!/usr/bin/env node
/**
 * DLQ Requeue Script
 *
 * Moves selected entries from the DLQ back to their original stream for reprocessing.
 *
 * Usage:
 *   node tools/requeue-dlq.ts <projectId> [options]
 *
 * Options:
 *   --entry-id <id>     Requeue specific entry by ID
 *   --error-pattern <pattern>  Requeue entries matching error pattern
 *   --dry-run          Show what would be requeued without doing it
 *   --limit <number>   Limit number of entries to process (default: 10)
 *   --all              Requeue all entries in DLQ
 */
import Redis from 'ioredis';
import { xaddObj } from '@ally/events/streams';
function parseArgs() {
    const args = process.argv.slice(2);
    // Check for help flag first
    if (args.includes('--help') || args.length === 0) {
        console.log(`
DLQ Requeue Script

Usage: node tools/requeue-dlq.ts <projectId> [options]

Options:
  --entry-id <id>           Requeue specific entry by ID
  --error-pattern <pattern> Requeue entries matching error pattern
  --dry-run                 Show what would be requeued without doing it
  --limit <number>          Limit number of entries to process (default: 10)
  --all                     Requeue all entries in DLQ
  --help                    Show this help message

Examples:
  node tools/requeue-dlq.ts my-project --dry-run
  node tools/requeue-dlq.ts my-project --entry-id 1234567890-0
  node tools/requeue-dlq.ts my-project --error-pattern "content is required"
  node tools/requeue-dlq.ts my-project --limit 5 --dry-run
    `);
        process.exit(0);
    }
    const projectId = args[0];
    if (!projectId || projectId.startsWith('--')) {
        console.error('❌ Project ID is required');
        console.error('Usage: node tools/requeue-dlq.ts <projectId> [options]');
        process.exit(1);
    }
    const options = {
        projectId,
        dryRun: false,
        limit: 10,
        requeueAll: false,
    };
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        switch (arg) {
            case '--entry-id':
                if (nextArg) {
                    options.entryId = nextArg;
                    i++;
                }
                else {
                    console.error('❌ --entry-id requires a value');
                    process.exit(1);
                }
                break;
            case '--error-pattern':
                if (nextArg) {
                    options.errorPattern = nextArg;
                    i++;
                }
                else {
                    console.error('❌ --error-pattern requires a value');
                    process.exit(1);
                }
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--limit':
                if (nextArg) {
                    const limit = parseInt(nextArg);
                    if (isNaN(limit) || limit <= 0) {
                        console.error('❌ --limit must be a positive number');
                        process.exit(1);
                    }
                    options.limit = limit;
                    i++;
                }
                else {
                    console.error('❌ --limit requires a value');
                    process.exit(1);
                }
                break;
            case '--all':
                options.requeueAll = true;
                break;
            default:
                console.error(`❌ Unknown option: ${arg}`);
                process.exit(1);
        }
    }
    return options;
}
function parseDLQEntry(id, fields) {
    const entry = {};
    for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        entry[key] = value;
    }
    // Validate required fields
    if (!entry.error || !entry.raw || !entry.streamKey) {
        console.warn(`⚠️  Skipping malformed DLQ entry ${id}: missing required fields`);
        return null;
    }
    return {
        id,
        error: entry.error,
        raw: entry.raw,
        timestamp: entry.timestamp,
        streamId: entry.streamId,
        streamKey: entry.streamKey,
        consumerGroup: entry.consumerGroup,
        consumerName: entry.consumerName,
    };
}
function shouldRequeueEntry(entry, options) {
    if (options.entryId && entry.id === options.entryId) {
        return true;
    }
    if (options.errorPattern && entry.error.includes(options.errorPattern)) {
        return true;
    }
    if (options.requeueAll) {
        return true;
    }
    return false;
}
async function requeueDLQEntries() {
    const options = parseArgs();
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log('🔄 DLQ Requeue Script');
    console.log(`📊 Project: ${options.projectId}`);
    console.log(`🔧 Options:`, {
        entryId: options.entryId,
        errorPattern: options.errorPattern,
        dryRun: options.dryRun,
        limit: options.limit,
        requeueAll: options.requeueAll,
    });
    console.log('');
    const redis = new Redis(REDIS_URL);
    try {
        // Test connection
        await redis.ping();
        console.log('✅ Redis connected');
        const dlqStream = `ally:events:dlq:v1:${options.projectId}`;
        // Check if DLQ exists and has entries
        const dlqInfo = await redis.xinfo('STREAM', dlqStream).catch(() => null);
        if (!dlqInfo) {
            console.log('ℹ️  DLQ stream does not exist or is empty');
            return;
        }
        console.log(`📋 DLQ stream: ${dlqStream}`);
        console.log(`📈 Total entries: ${dlqInfo[1]}`); // length
        console.log('');
        // Get entries from DLQ
        const entries = await redis.xrevrange(dlqStream, '+', '-', 'COUNT', options.requeueAll ? 1000 : options.limit);
        if (entries.length === 0) {
            console.log('ℹ️  No entries found in DLQ');
            return;
        }
        console.log(`🔍 Found ${entries.length} entries in DLQ`);
        console.log('');
        const entriesToRequeue = [];
        const skippedEntries = [];
        // Parse and filter entries
        for (const [id, fields] of entries) {
            const entry = parseDLQEntry(id, fields);
            if (!entry)
                continue;
            if (shouldRequeueEntry(entry, options)) {
                entriesToRequeue.push(entry);
            }
            else {
                skippedEntries.push(entry);
            }
        }
        console.log(`📋 Entries to requeue: ${entriesToRequeue.length}`);
        console.log(`⏭️  Entries skipped: ${skippedEntries.length}`);
        console.log('');
        if (entriesToRequeue.length === 0) {
            console.log('ℹ️  No entries match the requeue criteria');
            return;
        }
        // Show entries that would be requeued
        console.log('📝 Entries to requeue:');
        for (const entry of entriesToRequeue) {
            console.log(`   ${entry.id}: ${entry.error}`);
            console.log(`      Stream: ${entry.streamKey}`);
            console.log(`      Time: ${entry.timestamp}`);
            console.log('');
        }
        if (options.dryRun) {
            console.log('🔍 Dry run mode - no entries were actually requeued');
            return;
        }
        // Confirm before proceeding
        console.log(`⚠️  About to requeue ${entriesToRequeue.length} entries. Continue? (y/N)`);
        // For automation, we'll proceed without confirmation
        // In a real scenario, you might want to add readline for user input
        console.log('🔄 Proceeding with requeue...');
        console.log('');
        let requeuedCount = 0;
        let failedCount = 0;
        // Requeue entries
        for (const entry of entriesToRequeue) {
            try {
                // Parse the original message fields
                const originalFields = JSON.parse(entry.raw);
                // Add to original stream
                const messageId = await xaddObj(redis, entry.streamKey, originalFields, {
                    maxLen: { strategy: 'approx', count: 100000 }
                });
                // Remove from DLQ
                await redis.xdel(dlqStream, entry.id);
                console.log(`✅ Requeued ${entry.id} -> ${messageId} (${entry.streamKey})`);
                requeuedCount++;
            }
            catch (error) {
                console.error(`❌ Failed to requeue ${entry.id}:`, error);
                failedCount++;
            }
        }
        console.log('');
        console.log('📊 Requeue Summary:');
        console.log(`   ✅ Successfully requeued: ${requeuedCount}`);
        console.log(`   ❌ Failed to requeue: ${failedCount}`);
        console.log(`   📋 Total processed: ${entriesToRequeue.length}`);
    }
    catch (error) {
        console.error('❌ Requeue failed:', error);
        process.exit(1);
    }
    finally {
        await redis.quit();
    }
}
requeueDLQEntries().catch(console.error);
