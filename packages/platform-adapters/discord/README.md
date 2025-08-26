# @ally/platform-adapter-discord

Discord ingestion adapter that connects a Discord bot (discord.js v14) and publishes normalized events to your message bus via a provided Publisher.

## What it does

- Connects to Discord using `DISCORD_BOT_TOKEN` (or an explicit token)
- Subscribes to message create/update events with the required gateway intents
- Normalizes raw Discord messages into `@ally/events` schemas:
  - `DiscordMessageCreated`
  - `DiscordMessageUpdated`
- Emits event envelopes using your provided `Publisher`
- Contains no scoring/business logic

## Install

This package is part of the monorepo; dependencies are installed at the root:

```bash
yarn install
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

## Events and schemas

Normalized payloads conform to `@ally/events`:

- `DiscordMessageCreated`
- `DiscordMessageUpdated`

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

Tests cover the normalization logic in `src/normalizers.ts`.

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

- The adapter only publishes message create/update events for now. Reactions can be added later.
- No persistence or business/scoring logic is included here.
