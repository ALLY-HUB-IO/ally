# Scoring Service

The scoring service processes events from the ingest stream and applies scoring algorithms to messages using a platform-agnostic architecture.

## 🏗️ Architecture Overview

The scoring service uses a **platform-agnostic architecture** that routes events to platform-specific processors:

```
Event Envelope → Platform Router → Platform Processor → Database
     ↓              ↓                    ↓              ↓
  Discord        DiscordEvent        Message/        Normalized
  Telegram       Processor           Reaction        Data
  Twitter        TelegramEvent       Processing      Storage
                 Processor
```

## 📁 File Structure

```
src/
├── index.ts                     # Main service entry point with Express API
├── worker.ts                    # Main worker class with platform routing
├── types.ts                     # Shared interfaces and types
├── processors/                  # Platform-specific event processors
│   ├── index.ts                # Export all processors
│   ├── discordProcessor.ts     # Discord event handling
│   └── telegramProcessor.ts    # Telegram event handling (example)
└── README.md                   # This file
```

## 🔧 Key Components

### **1. Main Service (`index.ts`)**
- **Express API**: Provides REST endpoints for scoring
- **Worker Management**: Starts and manages the scoring worker
- **Health Checks**: Database and Redis connectivity
- **Graceful Shutdown**: Handles SIGTERM/SIGINT

### **2. Main Worker (`worker.ts`)**
- **Platform Routing**: Routes events to appropriate processors
- **Event Processing**: Handles Redis streams and message acknowledgment
- **Statistics**: Tracks processing metrics
- **Error Handling**: Manages failures and DLQ routing

### **3. Shared Types (`types.ts`)**
- **PlatformEventProcessor**: Interface for all platform processors
- **MessageContext**: Enum for different message types (comment, reply, thread, DM)
- **WorkerConfig**: Configuration for the worker
- **WorkerStats**: Statistics tracking

### **4. Platform Processors (`processors/`)**
Each platform has its own processor that implements the `PlatformEventProcessor` interface:

#### **Discord Processor (`discordProcessor.ts`)**
- Handles Discord-specific events (messages, reactions, updates, deletions, thread lifecycle)
- Context detection (comment, reply, thread answer, DM)
- Message relationship tracking (replies, thread parents)
- Thread lifecycle management (creation, deletion, message relations)
- Discord-specific data storage (guild, channel, thread, embeds, attachments)
- Comprehensive scoring with detailed breakdowns and metadata

#### **Telegram Processor (`telegramProcessor.ts`)**
- Handles Telegram-specific events
- Context detection (comment, reply, DM, forwarded messages)
- Telegram-specific data handling (chat types, user info)

## 🎯 Event Processing Flow

### **For Message Created Events:**
1. **Context Detection**: Determine message type (comment, reply, thread, DM)
2. **User Management**: Create/update platform user (no user relationship required)
3. **Source Management**: Create/update platform source (channel, chat, etc.)
4. **Message Storage**: Save message with proper relationships
5. **Platform Details**: Store platform-specific data
6. **AI Scoring**: Score with context information
7. **Score Storage**: Save comprehensive scoring breakdown with metadata
8. **Relations**: Handle reply and thread relationships (filtered for thread messages)
9. **Event Publishing**: Publish scored event to stream

### **For Thread Creation Events:**
1. **Thread Detection**: Identify thread creation via Discord.js ThreadCreate event
2. **Starter Message Update**: Update origin message with threadId in DiscordMessageDetail
3. **Database Consistency**: Ensure proper thread relationship tracking

### **For Thread Deletion Events:**
1. **Thread Identification**: Find all messages in the deleted thread
2. **Message Cleanup**: Mark thread messages as deleted (except starter message)
3. **Starter Message Restoration**: Remove threadId from starter message, restore to normal message

### **For Reaction Events:**
1. **Message Lookup**: Find the target message
2. **User Management**: Create/update reactor user
3. **Reaction Storage**: Add/remove reaction with proper relationships
4. **Fallback Handling**: Handle cases where Discord doesn't provide user info for reaction removal

## 🚀 Adding New Platforms

To add a new platform (e.g., Twitter):

### **Step 1: Create Processor**
```typescript
// src/processors/twitterProcessor.ts
export class TwitterEventProcessor implements PlatformEventProcessor {
  canHandle(platform: string, eventType: string): boolean {
    return platform === 'twitter' && [
      'TWITTER_TWEET_CREATED',
      'TWITTER_TWEET_UPDATED',
      'TWITTER_RETWEET_ADDED',
      'TWITTER_LIKE_ADDED'
    ].includes(eventType);
  }

  async processEvent(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void> {
    // Twitter-specific logic
  }
}
```

### **Step 2: Export from Index**
```typescript
// src/processors/index.ts
export { TwitterEventProcessor } from './twitterProcessor.js';
```

### **Step 3: Add to Worker**
```typescript
// src/worker.ts
import { TwitterEventProcessor } from './processors/index.js';

// In constructor:
this.platformProcessors = [
  new DiscordEventProcessor(),
  new TelegramEventProcessor(), // not in use yet
  new TwitterEventProcessor(), // New platform! does not exist yet
];
```

## 📊 Message Context Types

| **Context** | **Description** | **Examples** |
|-------------|-----------------|--------------|
| `COMMENT` | Regular message | Discord channel message, Telegram group message |
| `REPLY` | Reply to another message | Discord reply, Telegram reply |
| `THREAD_ANSWER` | Message in a thread | Discord thread message (filtered from message relations) |
| `DM` | Direct message | Discord DM, Telegram private chat |

## 🔄 Benefits of This Architecture

| **Benefit** | **Description** |
|-------------|-----------------|
| **Modularity** | Each platform is isolated and maintainable |
| **Extensibility** | Easy to add new platforms without touching existing code |
| **Type Safety** | Shared interfaces ensure consistency |
| **Testability** | Each processor can be tested independently |
| **Scalability** | Platform-specific optimizations possible |
| **Maintainability** | Clear separation of concerns |

## ⚙️ Configuration

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

## 🌐 API Endpoints

- `GET /health` - Health check
- `GET /stats` - Worker statistics
- `POST /v1/score` - Synchronous scoring
- `POST /v1/score-jobs` - Asynchronous scoring jobs
- `GET /v1/score-jobs/:id` - Job status
- `POST /v1/rescore/:messageId` - Force rescore

## 🧪 Testing

### Integration Test

Run the integration test to verify worker functionality:

```bash
# Start Redis (if not running)
docker run -d -p 6379:6379 redis:alpine

# Run integration test
npm run test:integration
```

This test will:
- Publish valid, unsupported, and malformed messages to the ingest stream
- Wait for processing
- Check DLQ for errors
- Check scored stream for results
- Display consumer group information

### Testing Strategy

The service uses integration tests rather than unit tests to avoid complex Jest configuration with ES modules. The integration test provides comprehensive verification of the worker functionality.

## 📈 Consumer Group Details

- **Group Name**: `cg:scoring:v1:<projectId>`
- **Consumer Name**: `scoring-<process.pid>`
- **Stream**: `ally:events:ingest:v1:<projectId>:discord`
- **Batch Size**: 50 messages
- **Block Time**: 5000ms

## 📊 DLQ Structure

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

## 📊 Statistics

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

## 🚀 Recent Enhancements

- **Thread Lifecycle Management**: Complete Discord thread creation and deletion handling
- **Message Reference Debugging**: Enhanced Discord message reference capture and processing
- **Comprehensive Scoring**: Detailed score breakdowns with metadata and processing information
- **Production-Ready Logging**: Clean, focused logging for better monitoring
- **Database Schema Integration**: Full integration with normalized database schema
- **Platform-Specific Data**: Enhanced Discord message detail storage and management

## 🚀 Future Enhancements

- **Caching**: Add Redis caching for frequently accessed data
- **Batch Processing**: Process multiple events in batches
- **Metrics**: Add detailed metrics for each platform
- **Rate Limiting**: Platform-specific rate limiting
- **Retry Logic**: Smart retry mechanisms for failed events
- **Dead Letter Queues**: Platform-specific DLQ handling
- **Horizontal Scaling**: Multiple consumers for high throughput


## Access to Database
`cd /Users/simonpiazolo/github/ally/packages/db && POSTGRES_URL=postgresql://ally:secret@localhost:5432/allyhub npx prisma studio --port 5555`