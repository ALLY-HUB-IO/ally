## @ally/db — Prisma + Postgres

This package provides the Prisma client and schema for Ally's Postgres database. It can be imported by any service to read and write data consistently with full type safety.

### What's inside
- Prisma schema and generated client
- Helper to get a shared `PrismaClient` instance
- Comprehensive persistence service with normalized data structure
- Migrations for all tables: `User`, `PlatformUser`, `Source`, `Message`, `Score`, `Reaction`, `MessageRelation`, `DiscordMessageDetail`, `MetricSnapshot`, `IngestCheckpoint`, `Campaign`, `CampaignEpoch`, `Payout`, `Admin`, `SystemConfig`, `EventsRaw`

### Prerequisites
- Docker (for local Postgres)
- Node/Yarn (workspace install)

### Start Postgres (local)
From the repo root:
```bash
docker compose -f infra/docker-compose.yml up -d postgres
```

Check health:
```bash
docker compose -f infra/docker-compose.yml ps
```

### Environment
Set a connection URL for Prisma. Options:
- Use `infra/.env` for Docker services (recommended):
```
POSTGRES_URL=postgresql://ally:secret@postgres/allyhub
```
- Or for local CLI usage (outside Docker), export inline or create `packages/db/.env`:
```
POSTGRES_URL=postgresql://ally:secret@localhost:5432/allyhub?schema=public
```

### Install deps and generate client
From the repo root:
```bash
yarn install
```
From this package:
```bash
cd packages/db
npx --yes prisma generate
```

### Apply migrations
```bash
cd packages/db
# Local host connection
POSTGRES_URL=postgresql://ally:secret@localhost:5432/allyhub npx --yes prisma migrate dev --name init

# Or if you have packages/db/.env set, simply:
npx --yes prisma migrate dev
```

### Explore data
```bash
cd packages/db
npx --yes prisma studio
```

### Using the database in a service

#### Option 1: Direct Prisma Client (Advanced)
1) Add a dependency on this package in your service `package.json`:
```json
{
  "dependencies": {
    "@ally/db": "*"
  }
}
```

2) Import the client and use it:
```ts
// example.ts
import { getPrismaClient } from '@ally/db';

const db = getPrismaClient();

export async function example() {
  const user = await db.user.upsert({
    where: { wallet: '0x123...' },
    create: { wallet: '0x123...', displayName: 'Alice' },
    update: {}
  });

  const platformUser = await db.platformUser.upsert({
    where: { platform_platformId: { platform: 'discord', platformId: '123456' } },
    create: { 
      userId: user.id,
      platform: 'discord', 
      platformId: '123456',
      displayName: 'Alice#1234'
    },
    update: {}
  });

  const message = await db.message.create({
    data: {
      projectId: 'project-1',
      sourceId: 'source-1',
      externalId: 'msg-123',
      authorId: platformUser.id,
      content: 'Hello, world!'
    }
  });

  await db.score.create({
    data: {
      kind: 'sentiment',
      value: 0.82,
      messageId: message.id,
      platformUserId: platformUser.id,
      details: { sentiment: 0.8, confidence: 0.95 }
    }
  });

  await db.reaction.create({
    data: {
      kind: 'like',
      weight: 1,
      messageId: message.id,
      platformUserId: platformUser.id
    }
  });
}
```

#### Option 2: Persistence Service (Recommended)
Use the comprehensive persistence service for cleaner, more maintainable code:

```ts
// example.ts
import { createPersistenceService } from '@ally/db';

const persistence = createPersistenceService();

export async function example() {
  // User Management
  const user = await persistence.upsertUser('0x123...', 'Alice');
  
  // Update user information
  await persistence.updateUser(user.id, {
    displayName: 'Alice Updated',
    trust: 0.85
  });
  
  const platformUser = await persistence.upsertPlatformUser(
    user.id, 
    'discord', 
    '123456', 
    'Alice#1234'
  );
  
  // Update platform user information
  await persistence.updatePlatformUser(platformUser.id, {
    displayName: 'Alice#5678',
    avatarUrl: 'https://example.com/avatar.png'
  });

  // Source Management
  const source = await persistence.upsertSource(
    'discord',
    'channel-123',
    'project-1',
    'General Chat',
    'Main discussion channel'
  );

  // Message Management
  const message = await persistence.saveMessage({
    projectId: 'project-1',
    sourceId: source.id,
    externalId: 'msg-123',
    authorId: platformUser.id,
    content: 'Hello, world!',
    contentLang: 'en'
  });

  // Scoring
  await persistence.saveScore({
    messageId: message.id,
    platformUserId: platformUser.id,
    kind: 'sentiment',
    value: 0.82,
    details: { sentiment: 0.8, confidence: 0.95 }
  });

  // Reactions
  await persistence.addReaction({
    messageId: message.id,
    platformUserId: platformUser.id,
    kind: 'like',
    weight: 1
  });

  // Message Relations
  await persistence.addMessageRelation(
    message.id,
    'reply-to-msg-id',
    'REPLY_TO'
  );

  // Discord-specific details
  await persistence.saveDiscordMessageDetail(
    message.id,
    'guild-123',
    'channel-456',
    undefined, // threadId (if in thread)
    [{ title: 'Embed Title' }], // embeds
    [{ id: 'att-1', url: 'https://example.com/file.png' }] // attachments
  );

  // Update Discord details (e.g., when thread is created)
  await persistence.updateDiscordMessageDetail(message.id, {
    threadId: 'thread-789'
  });

  // Get messages in a thread
  const threadMessages = await persistence.getMessagesByThreadId('thread-789');

  // Metrics
  await persistence.saveMetricSnapshot({
    messageId: message.id,
    likeCount: 5,
    replyCount: 2,
    viewCount: 100
  });
}
```

3) Health check example:
```ts
import { getPrismaClient } from '@ally/db';

export async function dbHealth() {
  try {
    await getPrismaClient().$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
```

### Database Schema Overview

#### Core Entities

**User**: Represents a user with wallet identity
- `id` (cuid), `wallet` (unique), `displayName?`, `trust` (float, default 0)
- Relations: `platformUsers`, `payouts`

**PlatformUser**: Platform-specific user accounts linked to main User
- `id`, `userId -> User`, `platform`, `platformId`, `displayName?`, `avatarUrl?`
- Relations: `messages`, `scores`, `reactions`, `payouts`
- Unique constraint: `(platform, platformId)`

**Source**: Data sources (Discord channels, Telegram chats, etc.)
- `id`, `platform`, `platformId`, `name?`, `description?`, `isActive`, `projectId`, `crawlConfig?`
- Relations: `messages`, `checkpoints`
- Unique constraint: `(platform, platformId)`

**Message**: Content from platforms with full context
- `id`, `projectId`, `sourceId -> Source`, `externalId`, `authorId -> PlatformUser`, `content`, `contentLang?`, `isDeleted`
- Relations: `scores`, `reactions`, `relationsFrom`, `relationsTo`, `discordDetails`, `metricSnapshots`
- Unique constraint: `(sourceId, externalId)`

**Score**: AI-generated scores for messages
- `id`, `kind`, `value`, `messageId -> Message`, `platformUserId -> PlatformUser`, `details?`
- Relations: `message`, `platformUser`

**Reaction**: User reactions to messages
- `id`, `kind`, `weight?`, `messageId -> Message`, `platformUserId -> PlatformUser`
- Relations: `message`, `platformUser`
- Unique constraint: `(messageId, platformUserId, kind)`

**MessageRelation**: Relationships between messages (replies, quotes, etc.)
- `id`, `kind` (REPLY_TO, QUOTE_OF, RETWEET_OF, REPOST_OF, THREAD_PARENT, MENTIONS), `fromId -> Message`, `toId -> Message`
- Relations: `from`, `to`

#### Platform-Specific Extensions

**DiscordMessageDetail**: Discord-specific message data
- `messageId -> Message`, `guildId?`, `channelId?`, `threadId?`, `embeds?`, `attachments?`
- Relations: `message`

**MetricSnapshot**: Per-message engagement metrics over time
- `id`, `messageId -> Message`, `capturedAt`, `likeCount?`, `replyCount?`, `repostCount?`, `quoteCount?`, `viewCount?`, `meta?`
- Relations: `message`

**IngestCheckpoint**: Resume state for data ingestion
- `id`, `sourceId -> Source`, `lastMessageId?`, `lastTimestamp?`, `cursor?`, `status`, `errorCount`, `lastError?`, `lastErrorAt?`
- Relations: `source`

#### Admin & Campaign System

**Admin**: Admin users for the dashboard
- `id`, `email` (unique), `name`, `passwordHash`, `isActive`, `lastLoginAt?`
- Relations: `campaigns`, `payouts`

**Campaign**: Token reward campaigns with epoch-based distribution
- `id`, `name`, `description?`, `tokenSymbol`, `isNative`, `chainId?`, `tokenAddress?`, `totalRewardPool` (Decimal), `startDate?`, `endDate?`, `isActive`, `isFunded`, `status` (DRAFT|ACTIVE|PAUSED|COMPLETED|CANCELED), `vaultAddress?`, `fundingTxHash?`, `maxRewardsPerUser?` (Decimal), `payoutIntervalSeconds`, `epochRewardCap` (Decimal), `claimWindowSeconds`, `recycleUnclaimed`, `platforms[]`, `createdById -> Admin`
- Relations: `createdBy`, `payouts`, `epochs`

**CampaignEpoch**: Individual payout windows for recurring campaigns
- `id`, `campaignId -> Campaign`, `epochNumber`, `epochStart`, `epochEnd`, `claimWindowEnds`, `allocated` (Decimal), `claimed` (Decimal), `recycledAt?`, `state` (OPEN|CLAIMING|RECYCLED|EXPIRED|CLOSED)
- Relations: `campaign`, `payouts`
- Unique constraint: `(campaignId, epochNumber)`

**Payout**: Individual user payouts
- `id`, `payoutAt?`, `status` (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED), `periodStart`, `periodEnd`, `platformUserId -> PlatformUser`, `userId -> User`, `campaignId -> Campaign`, `amount` (Decimal), `txHash?`, `errorMessage?`, `processedById? -> Admin`, `epochId? -> CampaignEpoch`
- Relations: `platformUser`, `user`, `campaign`, `processedBy`, `epoch`

#### System & Audit

**SystemConfig**: System configuration and settings
- `id`, `key` (unique), `value`, `updatedAt`

**EventsRaw**: Raw event persistence for audit trail
- `id`, `idempotencyKey` (unique), `projectId`, `platform`, `type`, `ts`, `source`, `payload`, `createdAt`

### Persistence Service API

The persistence service provides a clean interface for all database operations:

#### User Management
- `upsertUser(wallet, displayName?)` - Create/update user with wallet
- `updateUser(userId, updates)` - Update user information (displayName, trust)
- `getUserById(userId)` - Find user by ID
- `upsertPlatformUser(userId, platform, platformId, displayName?, avatarUrl?)` - Link platform account
- `updatePlatformUser(platformUserId, updates)` - Update platform user information (displayName, avatarUrl)
- `getUserByWallet(wallet)` - Find user by wallet
- `getPlatformUser(platform, platformId)` - Find platform user

#### Source Management
- `upsertSource(platform, platformId, projectId, name?, description?, crawlConfig?)` - Manage data sources
- `getSource(platform, platformId)` - Find source
- `updateSourceStatus(sourceId, isActive)` - Enable/disable sources

#### Message Management
- `saveMessage(data)` - Save new message
- `updateMessage(messageId, updates)` - Update message
- `getMessageByExternalId(sourceId, externalId)` - Find message by external ID
- `getMessagesByAuthor(authorId, limit?, offset?)` - Get user's messages

#### Scoring & Reactions
- `saveScore(data)` - Save AI score
- `updateScore(scoreId, value, details?)` - Update existing score
- `getScoresByMessage(messageId)` - Get all scores for a message
- `addReaction(data)` - Add reaction
- `removeReaction(messageId, platformUserId, kind)` - Remove reaction

#### Message Relations
- `addMessageRelation(fromId, toId, kind)` - Add reply/quote/etc. relationship
- `getMessageRelations(messageId, kind?)` - Get message relationships

#### Platform-Specific
- `saveDiscordMessageDetail(messageId, guildId?, channelId?, threadId?, embeds?, attachments?)` - Save Discord-specific data
- `updateDiscordMessageDetail(messageId, data)` - Update Discord-specific data (guildId, channelId, threadId, embeds, attachments)
- `getMessagesByThreadId(threadId)` - Get all messages in a specific thread

#### Ingest Management
- `updateIngestCheckpoint(sourceId, checkpoint)` - Update ingestion state
- `getIngestCheckpoint(sourceId)` - Get ingestion state
- `recordIngestError(sourceId, error)` - Record ingestion errors

#### Metrics & Snapshots
- `saveMetricSnapshot(data)` - Save engagement metrics
- `getMetricSnapshots(messageId, startDate?, endDate?)` - Get historical metrics

#### Campaign & Payout Management
- `createCampaign(data)` - Create reward campaign
- `getCampaign(campaignId)` - Get campaign details with epochs
- `getAllCampaigns(limit?, offset?)` - List all campaigns
- `updateCampaign(campaignId, updates)` - Update campaign
- `updateCampaignStatus(campaignId, status)` - Update campaign status
- `fundCampaign(campaignId, vaultAddress, fundingTxHash, startDate?)` - Fund and activate campaign

#### Campaign Epoch Management
- `createCampaignEpoch(data)` - Create new epoch for campaign
- `getCampaignEpoch(campaignId, epochNumber)` - Get specific epoch
- `getCampaignEpochs(campaignId, limit?, offset?)` - List campaign epochs
- `updateCampaignEpoch(epochId, updates)` - Update epoch (claimed amount, state, etc.)
- `getActiveEpochs(campaignId?)` - Get all open epochs
- `getClaimingEpochs()` - Get epochs in claiming phase

#### Payout Management
- `createPayout(data)` - Create payout record (with optional epochId)
- `getPayout(payoutId)` - Get payout details
- `getPayoutsByUser(userId, limit?, offset?)` - Get user's payouts
- `getPayoutsByCampaign(campaignId, limit?, offset?)` - Get campaign payouts
- `getPayoutsByEpoch(epochId, limit?, offset?)` - Get epoch payouts
- `updatePayoutStatus(payoutId, status, txHash?, errorMessage?, processedById?)` - Update payout

### Key Features

- **Normalized Design**: Clean separation between users, platform accounts, and content
- **Platform Agnostic**: Extensible design for Discord, Telegram, Twitter, etc.
- **Rich Relationships**: Support for replies, quotes, retweets, mentions, thread management
- **Engagement Tracking**: Per-message metrics over time with immutable snapshots
- **Reliable Ingestion**: Checkpoint system for resumable data processing
- **Epoch-Based Campaign System**: Recurring token rewards with automatic fund recycling and flexible payout windows
- **Thread Management**: Complete Discord thread lifecycle handling (creation, deletion, message relations)
- **Audit Trail**: Complete event history preservation
- **Type Safety**: Full TypeScript support with generated types

### Connecting from Docker vs local
- From services in Docker Compose: use host `postgres`, e.g. `postgresql://ally:secret@postgres/allyhub`
- From local CLI/tools: use `localhost:5432`, e.g. `postgresql://ally:secret@localhost:5432/allyhub`

### Common commands
```bash
# Generate client after schema changes
npx --yes prisma generate

# Create/apply migrations while developing
npx --yes prisma migrate dev --name <change>

# Inspect data visually
npx --yes prisma studio

# Reset database (DANGER - deletes all data)
npx --yes prisma migrate reset
```

### Migration History
- `20250814161611_init` - Initial schema with User, Message, Score, Reaction
- `20250828144151_add_events_raw_and_interactions` - Added EventsRaw and Interactions tables
- `20250917150703_add_admin_features` - Added Admin, Campaign, Payout, SystemConfig tables
- `20250924064336_update_metric_snapshot_and_add_missing_models` - Normalized schema with PlatformUser, Source, MessageRelation, DiscordMessageDetail, MetricSnapshot, IngestCheckpoint
- `20250924120000_remove_interactions_table` - Removed redundant Interactions table, consolidated into enhanced Message model
- `20250930130842_epoch_based_campaigns` - Added epoch-based campaign system with CampaignEpoch model, updated Campaign and Payout models for recurring payouts