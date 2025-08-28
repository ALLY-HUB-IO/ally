# CLI Tools

This directory contains command-line utilities for debugging and monitoring the Ally platform.

## tail-stream.js

A CLI tool to tail Redis streams and display new events as they arrive. Useful for debugging ingestion and monitoring event flow.

## tail-all-discord.js

A CLI tool to follow ALL Discord events for a project simultaneously. Shows message creation, updates, and reaction events in one view.

## requeue-dlq.ts

A CLI tool to move selected entries from the DLQ back to their original stream for reprocessing. Useful for recovering from transient errors or reprocessing messages after fixes.

### Usage

```bash
# Show help
node tools/requeue-dlq.ts --help

# Dry run - see what would be requeued
node tools/requeue-dlq.ts my-project --dry-run

# Requeue specific entry by ID
node tools/requeue-dlq.ts my-project --entry-id 1234567890-0

# Requeue entries matching error pattern
node tools/requeue-dlq.ts my-project --error-pattern "content is required"

# Requeue all entries (use with caution)
node tools/requeue-dlq.ts my-project --all

# Limit number of entries to process
node tools/requeue-dlq.ts my-project --limit 5 --dry-run
```

### Features

- **Selective Requeuing**: Requeue by entry ID, error pattern, or all entries
- **Dry Run Mode**: Preview what would be requeued without making changes
- **Safety Checks**: Validates DLQ entries before processing
- **Atomic Operations**: Removes from DLQ only after successful requeue
- **Comprehensive Logging**: Shows detailed progress and results

### Usage

```bash
# Basic usage - tail a stream and show last 10 entries + follow new events
yarn tail-stream <streamKey>

# Show last N entries before following
yarn tail-stream <streamKey> <count>

# Follow ALL Discord events for a project
yarn tail-all-discord <projectId> [count]

# Examples
yarn tail-stream ally:my-project:platform.discord.message.created
yarn tail-stream ally:my-project:platform.discord.message.created 5
yarn tail-all-discord my-first-project 5
```

### Environment Variables

- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379`)

**Note:** When using Docker Compose, use `REDIS_URL=redis://localhost:6379` to connect to the Redis container.

### Features

- **Recent History**: Shows last N entries before following new events
- **Real-time Following**: Displays new events as they arrive
- **Formatted Output**: Pretty-prints event payloads with timestamps
- **Error Handling**: Graceful error recovery and Ctrl+C handling
- **Connection Status**: Shows Redis connection status

### Output Format

```
[2024-01-01T12:00:00.000Z] platform.discord.message.created (discord:created:123456789:2024-01-01T12:00:00.000Z)
{
  "externalId": "123456789",
  "guildId": "guild-123",
  "channelId": "channel-456",
  "author": {
    "id": "user-789",
    "username": "alice",
    "isBot": false
  },
  "content": "Hello world!",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
---
```

### Stream Keys

Common stream keys for Ally platform:

- `ally:{PROJECT_ID}:platform.discord.message.created` - Discord message creation events
- `ally:{PROJECT_ID}:platform.discord.message.updated` - Discord message update events
- `ally:{PROJECT_ID}:platform.discord.message.deleted` - Discord message deletion events
- `ally:{PROJECT_ID}:platform.discord.reaction.added` - Discord reaction added events
- `ally:{PROJECT_ID}:platform.discord.reaction.removed` - Discord reaction removed events

Replace `{PROJECT_ID}` with your actual project ID (e.g., `my-first-project`).
