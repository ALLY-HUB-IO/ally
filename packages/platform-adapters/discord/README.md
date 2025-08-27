# @ally/platform-adapter-discord

Discord ingestion adapter that connects a Discord bot (discord.js v14) and publishes normalized events to your message bus via a provided Publisher.

## What it does

- Connects to Discord using `DISCORD_BOT_TOKEN` (or an explicit token)
- Subscribes to message create/update events with the required gateway intents
- Normalizes raw Discord messages, reactions, and deletions into `@ally/events` schemas:
  - `DiscordMessageCreated`
  - `DiscordMessageUpdated`
  - `DiscordMessageDeleted`
  - `DiscordReactionEvent` (for both added and removed reactions)
- Emits event envelopes using your provided `Publisher`
- Contains no scoring/business logic

## Install

This package is part of the monorepo; dependencies are installed at the root:

```bash
yarn install
```

### Configure environment (.env)

Add your Discord bot token to `infra/.env` (copy from `infra/example.env`):

```
DISCORD_BOT_TOKEN=your-bot-token-here
```

The adapter will pick it up via `process.env.DISCORD_BOT_TOKEN`. You can also pass `token` in `startDiscordAdapter` options if you prefer not to use env variables.

### Setup Discord Bot

1. **Create a Discord Application & Bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and give it a name
   - Go to "Bot" section and click "Add Bot"
   - Copy the bot token (you'll need this for `DISCORD_BOT_TOKEN`)

2. **Enable Required Gateway Intents**
   - In the Bot section, scroll down to "Privileged Gateway Intents"
   - Enable these intents:
     - ✅ **Message Content Intent** (required to read message content)
     - ✅ **Server Members Intent** (optional, for member info)
     - ✅ **Presence Intent** (optional, for presence updates)

3. **Invite Bot to Your Server**
   - Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot`
   - Select bot permissions: `Read Messages/View Channels`, `Read Message History`
   - Copy the generated URL and open it in a browser to invite the bot

4. **Add Token to Environment**
   - Add your bot token to `infra/.env`:
   ```env
   DISCORD_BOT_TOKEN=your-bot-token-here
   ```

## Usage

```ts
import { startDiscordAdapter } from "@ally/platform-adapter-discord";

// implement your Publisher to forward events to your queue/bus
const publisher = {
  publish: async (event) => {
    // e.g., push to Kafka, NATS, SQS, etc.
    console.log("event", event.type, event.payload.externalId);
  },
};

// ensure DISCORD_BOT_TOKEN is set in env or pass token option
startDiscordAdapter(
  { projectId: "your-project-id" },
  publisher
);
```

### Options

- `projectId` (string): Project/tenant identifier added to event envelopes
- `token` (string, optional): If omitted, `process.env.DISCORD_BOT_TOKEN` is used
- `includeBots` (boolean, optional): When `true`, messages from bot users are included (default: `false`)
- `allowedGuilds` (string[], optional): List of guild IDs to allow messages from (empty = all guilds)
- `allowedChannels` (string[], optional): List of channel IDs to allow messages from (empty = all channels)
- `minMessageLength` (number, optional): Minimum message length to process (default: 1)

## Events and schemas

Normalized payloads conform to `@ally/events`:

- `DiscordMessageCreated` - New messages
- `DiscordMessageUpdated` - Edited messages  
- `DiscordMessageDeleted` - Deleted messages
- `DiscordReactionEvent` - Reaction added/removed events

The adapter wraps these payloads in an envelope containing:

- `version` (`EVENT_VERSION`)
- `idempotencyKey`
- `projectId`
- `platform` ("discord")
- `type` (see `EventType` in `@ally/events/catalog`)
- `ts` (ISO timestamp)
- `source` (`guildId`, `channelId`, `threadId`)

## Development

- Build: `yarn build`
- Tests: `yarn test`
- E2E Tests: `yarn test:e2e` (requires valid `DISCORD_BOT_TOKEN` in `infra/.env`)

Tests cover the normalization logic in `src/normalizers.ts`. The E2E test connects to Discord and logs normalized messages for 5 seconds.

## Required intents

The adapter enables the following gateway intents:

- Guilds
- Guild Messages
- Message Content
- Guild Message Reactions
- Direct Messages
- Direct Message Reactions

Make sure these intents are enabled for your bot in the Discord Developer Portal when required.

## Notes

- The adapter publishes message create/update/delete events and reaction add/remove events.
- No persistence or business/scoring logic is included here.
