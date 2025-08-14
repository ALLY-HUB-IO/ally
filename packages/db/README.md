## @ally/db — Prisma + Postgres

This package provides the Prisma client and schema for Ally's Postgres database. It can be imported by any service to read and write data consistently with full type safety.

### What’s inside
- Prisma schema and generated client
- Helper to get a shared `PrismaClient` instance
- Migrations for the core tables: `User`, `Message`, `Score`, `Reaction`

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
    where: { identity: 'user-123' },
    create: { identity: 'user-123', displayName: 'Alice' },
    update: {}
  });

  const message = await db.message.create({
    data: {
      content: 'Hello, world',
      authorId: user.id
    }
  });

  await db.score.create({
    data: {
      kind: 'sentiment',
      value: 0.82,
      source: 'sentiment-service',
      messageId: message.id,
      userId: user.id
    }
  });

  await db.reaction.create({
    data: {
      kind: 'like',
      weight: 1,
      messageId: message.id,
      userId: user.id
    }
  });
}
```

3) Health check example (optional):
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

### Database layout (high level)
- **User**: represents an actor (wallet, username, platform id)
  - `id` (cuid), `identity` (unique), `displayName?`, `trust` (float, default 0)
  - Relations: `messages`, `scores`, `reactions`

- **Message**: content produced by a user (or imported)
  - `id`, `content`, `externalId?`, `authorId? -> User`
  - Relations: `scores`, `reactions`

- **Score**: numeric evaluation produced by a service
  - `id`, `kind` (e.g. sentiment, toxicity, relevance), `value` (float), `source`
  - `messageId -> Message`, `userId? -> User`
  - Indexes: `(messageId, kind)`, `(userId, kind)`

- **Reaction**: human/app feedback on a message
  - `id`, `kind` (like, dislike, emoji name), `weight?` (default 1)
  - `messageId -> Message`, `userId -> User`
  - Indexes: `(messageId, kind)`, `(userId, kind)`

These entities support analytics like per-user trust aggregation, score/reaction distributions, and audits by message and source.

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
```


