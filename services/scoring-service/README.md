# Scoring Service

The scoring service processes events from the ingest stream and applies scoring algorithms to messages.

## Features

- **Redis Stream Consumer**: Consumes events from `ally:events:ingest:v1:<projectId>:discord`
- **Event Routing**: Routes events by type (currently processes `platform.discord.message.created`)
- **Scoring Orchestration**: Uses the scoring orchestrator to compute multi-factor scores
- **Error Handling**: Sends failed messages to DLQ with error details
- **Statistics**: Provides real-time processing statistics via `/stats` endpoint
- **Graceful Shutdown**: Handles SIGTERM/SIGINT for clean shutdown

## Architecture

### Worker Implementation

The `ScoringWorker` class in `src/worker.ts` implements:

1. **Consumer Group Management**: Creates consumer group if missing
2. **Message Processing**: Parses event envelopes and routes by type
3. **Scoring**: Calls the scoring orchestrator for multi-factor analysis
4. **Error Recovery**: Sends failed messages to DLQ
5. **Statistics Tracking**: Monitors processing metrics

### Event Flow

```
Ingest Stream → Consumer Group → Worker → Scoring Orchestrator → (Future: DB + Scored Stream)
                ↓
              DLQ (on error)
```

## Configuration

Set these environment variables:

```env
# Required
REDIS_URL=redis://redis:6379
PROJECT_ID=your-project-id

# Optional
PORT=8081
TEC_CHAT_ID=default-project
POSTGRES_URL=postgresql://...
```

## API Endpoints

- `GET /health` - Health check
- `GET /stats` - Worker statistics
- `POST /v1/score` - Synchronous scoring
- `POST /v1/score-jobs` - Asynchronous scoring jobs
- `GET /v1/score-jobs/:id` - Job status
- `POST /v1/rescore/:messageId` - Force rescore

## Testing

### Manual Test

Run the manual test to verify worker functionality:

```bash
# Start Redis (if not running)
docker run -d -p 6379:6379 redis:alpine

# Run test
node test-worker.js
```

### Unit Tests

```bash
npm test
```

## Consumer Group Details

- **Group Name**: `cg:scoring:v1:<projectId>`
- **Consumer Name**: `scoring-<process.pid>`
- **Stream**: `ally:events:ingest:v1:<projectId>:discord`
- **Batch Size**: 50 messages
- **Block Time**: 5000ms

## DLQ Structure

Failed messages are sent to `ally:events:dlq:v1:<projectId>` with:

```json
{
  "error": "Error message",
  "raw": "Original message fields",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "streamId": "message-id",
  "streamKey": "source-stream",
  "consumerGroup": "cg:scoring:v1:project",
  "consumerName": "scoring-123"
}
```

## Statistics

The `/stats` endpoint returns:

```json
{
  "messagesReceived": 100,
  "messagesProcessed": 95,
  "messagesFailed": 3,
  "messagesIgnored": 2,
  "lastProcessedAt": "2024-01-01T00:00:00.000Z"
}
```

## Future Enhancements

- Database persistence (step 10)
- Scored stream publishing (step 11)
- Support for more event types
- Metrics and monitoring
- Horizontal scaling with multiple consumers


