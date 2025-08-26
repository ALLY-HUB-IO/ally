## @ally/events

Shared event catalog, payload schemas, envelope types, and Redis Streams helpers for ALLY services.

### What’s inside
- Event catalog and versioning: `@ally/events/catalog`
- Envelope type: `@ally/events/envelope`
- Discord payload schemas (zod): `@ally/events/schemas`
- Redis stream naming + helpers: `@ally/events/streams`

### Install / build
```bash
yarn workspace @ally/events build
yarn workspace @ally/events test
```

### Exports
```ts
// Catalog
import { EVENT_VERSION, EventType, type EventName } from "@ally/events/catalog";

// Envelope
import type { EventEnvelope } from "@ally/events/envelope";

// Discord schemas (zod)
import {
  DiscordMessageCreated,
  DiscordMessageUpdated,
  type DiscordMessageCreated as DiscordMessageCreatedT,
  type DiscordMessageUpdated as DiscordMessageUpdatedT,
} from "@ally/events/schemas";

// Redis stream helpers
import {
  ingestStreamKey,
  scoredStreamKey,
  dlqStreamKey,
  xaddObj,
  xreadGroupOnce,
  xreadGroupLoop,
  objectToPairs,
  pairsToObject,
} from "@ally/events/streams";
```

### Event catalog
```ts
import { EVENT_VERSION, EventType } from "@ally/events/catalog";

// EVENT_VERSION = "v1"
// EventType = {
//   DISCORD_MESSAGE_CREATED: "platform.discord.message.created",
//   DISCORD_MESSAGE_UPDATED: "platform.discord.message.updated",
//   DISCORD_REACTION_ADDED: "platform.discord.reaction.added",
// }
```

### Schemas and envelope
```ts
import { DiscordMessageCreated } from "@ally/events/schemas";
import type { EventEnvelope } from "@ally/events/envelope";
import { EventType, EVENT_VERSION } from "@ally/events/catalog";

// Validate normalized payload (throws on invalid)
const payload = DiscordMessageCreated.parse(normalized);

// Create envelope
const env: EventEnvelope<typeof payload> = {
  version: EVENT_VERSION,
  idempotencyKey: `discord:${EventType.DISCORD_MESSAGE_CREATED}:${payload.externalId}:${payload.createdAt}`,
  projectId: projectId,
  platform: "discord",
  type: EventType.DISCORD_MESSAGE_CREATED,
  ts: new Date().toISOString(),
  source: { guildId: payload.guildId ?? undefined, channelId: payload.channelId, threadId: payload.threadId ?? undefined },
  payload,
};
```

### Redis stream naming
```ts
import { ingestStreamKey, scoredStreamKey, dlqStreamKey } from "@ally/events/streams";

const ingest = ingestStreamKey(projectId, "discord");      // ally:events:ingest:v1:<projectId>:discord
const scored = scoredStreamKey(projectId);                  // ally:events:scored:v1:<projectId>
const dlq = dlqStreamKey(projectId);                        // ally:events:dlq:v1:<projectId>
```

### Publishing (adapter)
```ts
import Redis from "ioredis";
import { ingestStreamKey, xaddObj } from "@ally/events/streams";

const redis = new Redis(process.env.REDIS_URL!);
const stream = ingestStreamKey(process.env.PROJECT_ID!, "discord");

await xaddObj(redis as any, stream, {
  version: env.version,
  idempotencyKey: env.idempotencyKey,
  projectId: env.projectId,
  platform: env.platform,
  type: env.type,
  ts: env.ts,
  source: JSON.stringify(env.source),
  payload: JSON.stringify(env.payload),
}, { maxLen: { strategy: "approx", count: 100000 } });
```

### Consuming (worker)
```ts
import Redis from "ioredis";
import { ingestStreamKey, xreadGroupLoop } from "@ally/events/streams";

const redis = new Redis(process.env.REDIS_URL!);
const projectId = process.env.PROJECT_ID!;
const stream = ingestStreamKey(projectId, "discord");
const group = `cg:scoring:v1:${projectId}`;
const consumer = `scoring-${process.pid}`;

// Ensure group exists
await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM").catch((e:any) => {
  if (!String(e?.message).includes("BUSYGROUP")) throw e;
});

await xreadGroupLoop(redis as any, {
  group,
  consumer,
  streams: [stream],
  count: 50,
  blockMs: 5000,
  handler: async ({ stream, id, fields }) => {
    // fields is a Record<string,string>
    const env = {
      ...fields,
      source: JSON.parse(fields.source || "{}"),
      payload: JSON.parse(fields.payload || "{}"),
    };
    // route by env.type, score, write to DB, publish to scored stream, etc.
  },
});
```

### Environment
- `PROJECT_ID` — required; used in stream keys
- `REDIS_URL` — `redis://redis:6379` in docker-compose; `redis://localhost:6379` locally

`infra/example.env` contains both keys:
```env
PROJECT_ID=my-first-project
REDIS_URL=redis://redis:6379
```

### Tests
- Unit tests run by default: `yarn workspace @ally/events test`
- Redis integration test is opt-in:
```bash
REDIS_INTEGRATION=1 REDIS_URL=redis://localhost:6379 yarn workspace @ally/events test
```

### Versioning
- Events are versioned via `EVENT_VERSION` (currently "v1").
- Stream keys include the version so you can evolve formats without breaking consumers.


