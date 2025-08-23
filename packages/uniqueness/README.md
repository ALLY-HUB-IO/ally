# @ally/uniqueness

Uniqueness scoring utilities. Provides a pluggable `UniquenessScorer` with a memory backend and a pgvector-backed backend.

## Usage

```ts
import { createUniquenessScorer } from "@ally/uniqueness";

const scorer = await createUniquenessScorer({ backend: "memory", dim: 128 });
const scope = { projectId: "proj", platform: "discord", channelId: "ch" };

const result = await scorer.score("hello world", scope);
await scorer.upsert("message-1", "hello world", scope);
```

## Env

- `UNIQUENESS_BACKEND=pgvector|memory`
- `UNIQUENESS_DIM=128`

When using from other packages during development, you may set `UNIQUENESS_PKG=../../../packages/uniqueness/src/index.js` to bypass TS rootDir constraints.


