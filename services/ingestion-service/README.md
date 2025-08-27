# Ingestion Service

The ingestion service wires up platform adapters (currently Discord) and publishes normalized events to Redis streams for downstream processing.

## What it does

- Starts the Discord adapter with filtering capabilities
- Applies message filters (guild/channel allowlists, bot filtering, min length)
- Publishes events to Redis streams with proper idempotency keys
- Tracks statistics and provides health monitoring
- Handles graceful shutdown

## Configuration

Set these environment variables in `infra/.env`:

```env
# Required
REDIS_URL=redis://redis:6379
DISCORD_BOT_TOKEN=your-bot-token

# Optional filtering
DISCORD_ALLOWED_GUILDS=guild1,guild2
DISCORD_ALLOWED_CHANNELS=channel1,channel2
DISCORD_INCLUDE_BOTS=false
DISCORD_MIN_MESSAGE_LENGTH=1
```

## Redis Streams

Events are published to Redis streams with keys like:
- `ally:{PROJECT_ID}:platform.discord.message.created`
- `ally:{PROJECT_ID}:platform.discord.message.updated`

Each stream entry contains:
- `version`: Event schema version
- `idempotencyKey`: Unique identifier for deduplication
- `projectId`: Multi-tenant project identifier
- `platform`: Source platform ("discord")
- `type`: Event type from catalog
- `ts`: ISO timestamp when published
- `source`: JSON string with guildId, channelId, threadId
- `payload`: JSON string with normalized message data

## Idempotency Keys

Format: `discord:{type}:{messageId}:{timestamp}`
- `discord:created:123456789:2024-01-01T00:00:00.000Z`
- `discord:updated:123456789:2024-01-01T01:00:00.000Z`

## Filtering

The service applies these filters in order:

1. **Minimum message length**: Messages shorter than `DISCORD_MIN_MESSAGE_LENGTH` are dropped
2. **Guild allowlist**: If `DISCORD_ALLOWED_GUILDS` is set, only messages from those guilds are processed
3. **Channel allowlist**: If `DISCORD_ALLOWED_CHANNELS` is set, only messages from those channels are processed
4. **Bot filtering**: Bot messages are dropped unless `DISCORD_INCLUDE_BOTS=true`

## Statistics

The service logs statistics every 100 messages and every 30 seconds:
- `messagesReceived`: Total messages from Discord
- `messagesPublished`: Messages successfully published to Redis
- `messagesFiltered`: Messages dropped by filters
- `errors`: Failed publish attempts

## Development

```bash
# Build
yarn build

# Run locally
yarn dev

# Run with Docker Compose
cd infra
docker compose up ingestion-service
```

**Note:** This service requires Node.js 22+ for compatibility with dependencies.

## Health Monitoring

The service performs health checks on startup and logs Redis connection status. Failed Redis connections will cause the service to exit.
