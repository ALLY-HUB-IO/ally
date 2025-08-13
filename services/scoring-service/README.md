Scoring Service

Synchronous and asynchronous scoring API that evaluates messages using Theta EdgeCloud via `@ally/intelligence-edgecloud`.

- Default port: `8081`
- ESM Node 20 runtime (Docker)
- Redis and Postgres are optional; current build runs without them

Environment variables

Configure via `infra/.env` (see `infra/example.env`):

- `PORT` (default `8081`)
- `TEC_RAG_BASE_URL` (e.g., `https://your-edgecloud-gateway/api`)
- `TEC_RAG_API_KEY` (Bearer token for EdgeCloud)
- `TEC_CHAT_ID` (default chat/project identifier)
- `REDIS_URL` (optional; if omitted, Redis features are disabled)
- `POSTGRES_URL` (optional; not required yet)

Run locally (workspace)

```bash
# from repo root
# YARN_IGNORE_ENGINES=1 yarn install
yarn workspace @ally/intelligence-edgecloud build
yarn workspace scoring-service dev
# Service listens on http://localhost:8081
```

Run with Docker Compose

```bash
cp infra/example.env infra/.env   # adjust TEC_* values
cd infra
# bring up redis + scoring-service
docker compose up --build
```

Health check: GET http://localhost:8081/health

API

POST /v1/score

Synchronous scoring. Returns a score immediately after calling EdgeCloud.

Request

```json
{
  "message": { "id": "m1", "text": "Great work on the launch!" },
  "projectId": "optional-override-of-TEC_CHAT_ID"
}
```

Response

```json
{
  "ok": true,
  "result": {
    "messageId": "m1",
    "projectId": "theta-kb-01",
    "score": 0.86,
    "sentiment": "positive",
    "rationale": "...",
    "sources": [
      { "url": "https://...", "snippet": "..." }
    ]
  }
}
```

Example

```bash
curl -s -X POST http://localhost:8081/v1/score \
  -H 'content-type: application/json' \
  -d '{"message":{"id":"m1","text":"Great work on the launch!"}}'
```

POST /v1/score-jobs

Create an asynchronous scoring job. Returns jobId and processes in the background.

Request

```json
{
  "message": { "id": "m2", "text": "This is mid." },
  "projectId": "optional-override"
}
```

Response

```json
{ "ok": true, "jobId": "4a8a..." }
```

Example

```bash
curl -s -X POST http://localhost:8081/v1/score-jobs \
  -H 'content-type: application/json' \
  -d '{"message":{"id":"m2","text":"This is mid."}}'
```

GET /v1/score-jobs/:id

Fetch job status or result.

Response

```json
{
  "ok": true,
  "job": {
    "id": "4a8a...",
    "status": "queued|processing|done|error",
    "result": { "messageId": "m2", "projectId": "...", "score": 0.5, "sentiment": "neutral", "rationale": "...", "sources": [] },
    "error": "optional error message"
  }
}
```

Example

```bash
curl -s http://localhost:8081/v1/score-jobs/<jobId>
```

POST /v1/rescore/:messageId

Force recomputation for an existing message (e.g., after reactions). Uses the provided text and optional projectId.

Request

```json
{ "text": "Updated content after reactions", "projectId": "optional-override" }
```

Response

```json
{ "ok": true, "jobId": "c2bf..." }
```

Example

```bash
curl -s -X POST http://localhost:8081/v1/rescore/m2 \
  -H 'content-type: application/json' \
  -d '{"text":"Updated content after reactions"}'
```

GET /health

Basic health probe.

- 200: { "ok": true }
- 500: { "ok": false, "error": "..." }

Scoring behavior

- Uses Theta EdgeCloud RAG chat (`/chatbot/{projectId}/chat/completions`) via `@ally/intelligence-edgecloud`.
- Sends a system prompt that asks the model to return strict JSON with { score, sentiment, rationale }.
- Attempts to parse JSON from the model output; falls back to defaults if parsing fails.
- Replace the in-memory jobs with Redis/queues and add persistence when needed.

Notes

- `TEC_CHAT_ID` is used as default projectId if not provided per request.
- Redis and Postgres are optional; health checks skip them if env vars are not set.


