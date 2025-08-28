# ALLY-Hub

**Automated AI-driven engagement scoring and tokenized rewards platform**

---

## 🚀 Project Overview

ALLY-Hub is a mono-repo for a service-oriented platform that ingests social interactions (e.g., Discord messages), evaluates their value and sentiment using AI, and exposes simple APIs you can integrate with other systems. The repo currently includes:

- A static marketing site (`apps/website`)
- A TypeScript scoring service (`services/scoring-service`) with Redis event streaming
- A Python FastAPI sentiment/NER service (`services/sentiment-service`) with intelligence analysis
- Shared TypeScript libraries in `packages/`
- PostgreSQL database with Prisma ORM (`packages/db`)

The goal is to create:
- Real-time event ingestion and scoring pipeline
- View real-time stats & trends
- Inspect scored interactions with rationale & sentiment
- Collect data for fine-tuning AI models

---

## 📁 Repository Structure (current)

```text
ally/
├── apps/
│   └── website/                 # Static public site (HTML/CSS)
├── packages/
│   ├── db/                      # Prisma schema/client for Postgres
│   ├── events/                  # Redis event streaming utilities
│   ├── intelligence/
│   │   └── edgecloud/           # EdgeCloud RAG client (Theta provider)
│   ├── scoring-orchestrator/    # Combines sentiment + value + intelligence scoring
│   ├── uniqueness/              # Content uniqueness scoring
│   └── platform-adapters/       # Discord adapter
├── services/
│   ├── scoring-service/         # Node/Express API with Redis event streaming
│   └── sentiment-service/       # FastAPI service (sentiment + NER + intelligence)
├── infra/                       # docker-compose, env example and prompts file
└── tools/                       # CLI tools for monitoring and testing
```

---

## 🛠️ Prerequisites

- Node.js v20.x (Yarn 1.x)
- Python 3.11
- Docker & Docker Compose
- Redis (via Docker)
- PostgreSQL (via Docker)

---

## ⚙️ Getting Started (Local)

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/ally.git
cd ally
yarn install
```

### 2. Configure Environment

```bash
cd infra
cp example.env .env
```

Edit `infra/.env` and set the following key variables:

```bash
# Project configuration
PROJECT_ID=my-first-project
REDIS_URL=redis://redis:6379

# Database (optional for now)
POSTGRES_URL=postgresql://ally:secret@localhost:5432/allyhub

# Sentiment service configuration
SENTIMENT_MODEL_ID=BVK97/Discord-NFT-Sentiment
SPACY_MODEL=en_core_web_sm

# Sentiment service URL (for Docker networking)
SENTIMENT_SERVICE_URL=http://sentiment:8080

# Discord bot (for ingestion)
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# EdgeCloud configuration (optional)
TEC_RAG_BASE_URL=your_edgecloud_url
TEC_RAG_API_KEY=your_edgecloud_api_key
TEC_CHAT_ID=your_chat_id
```

### 3. Start Local Stack

```bash
cd infra
docker compose up --build -d
```

This brings up:
- `sentiment-service` on http://localhost:8080
- `scoring-service` on http://localhost:8081
- `redis` on localhost:6379
- `postgres` on localhost:5432
- `ingestion-service` on http://localhost:8082

### 4. Verify Services

```bash
# Check sentiment service
curl -s http://localhost:8080/healthz

# Check scoring service
curl -s http://localhost:8081/health

# Check ingestion service
curl -s http://localhost:8082/health
```

---

## 🧪 Testing the System

### 1. Test Intelligence Service

```bash
# Test the new /analyze endpoint
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a great message about Theta Network!",
    "author": "test-user",
    "context": {"messageId": "test-123"}
  }'
```

Expected response:
```json
{
  "score": 0.6,
  "rationale": "Positive sentiment (positive) with 1 entities identified. Key entities: Theta Network",
  "sentiment": "positive",
  "entities": [...],
  "model": {...}
}
```

### 2. Test Scoring Service Integration

```bash
cd services/scoring-service
PROJECT_ID=my-first-project npm run test:integration
```

This test will:
- Publish test messages to the ingest stream
- Verify the worker processes them
- Check for scored events in the scored stream
- Show DLQ entries for failed messages

### 3. Test Database Persistence

```bash
cd packages/db
POSTGRES_URL="postgresql://ally:secret@localhost:5432/allyhub" node test-persistence.js
```

This will test:
- Saving raw events to `events_raw` table
- Saving scored interactions to `interactions` table
- Idempotency handling

### 4. Monitor Real-time Processing

```bash
# Check worker stats
curl -s http://localhost:8081/stats

# Check Redis streams
node -e "
const Redis = require('ioredis');
const redis = new Redis('redis://localhost:6379');

Promise.all([
  redis.xlen('ally:events:ingest:v1:my-first-project:discord'),
  redis.xlen('ally:events:scored:v1:my-first-project'),
  redis.xlen('ally:events:dlq:v1:my-first-project')
]).then(([ingest, scored, dlq]) => {
  console.log('Ingest stream:', ingest, 'entries');
  console.log('Scored stream:', scored, 'entries');
  console.log('DLQ stream:', dlq, 'entries');
  redis.disconnect();
});
"
```

### 5. View Database Data

```bash
cd packages/db
POSTGRES_URL="postgresql://ally:secret@localhost:5432/allyhub" node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

Promise.all([
  prisma.eventsRaw.count(),
  prisma.interactions.count()
]).then(([rawCount, interactionCount]) => {
  console.log('Raw events:', rawCount);
  console.log('Interactions:', interactionCount);
  prisma.\$disconnect();
});
"
```

---

## 🛑 Shutting Down

### 1. Stop All Services

```bash
cd infra
docker compose down
```

### 2. Clean Up (Optional)

```bash
# Remove all containers and volumes
docker compose down -v

# Remove all images
docker compose down --rmi all

# Clean up node_modules (if needed)
cd ..
rm -rf node_modules
yarn install
```

---

## 🔧 Local Development (Alternatives)

### Run Services Individually

```bash
# Build packages first
yarn workspace @ally/intelligence-edgecloud build
yarn workspace @ally/scoring-orchestrator build
yarn workspace @ally/db build
yarn workspace @ally/events build
yarn workspace @ally/uniqueness build

# Run scoring service locally
cd services/scoring-service
npm run dev
# → http://localhost:8081

# Run sentiment service locally
cd services/sentiment-service
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
# → http://localhost:8080
```

### Database Development

```bash
cd packages/db

# Run migrations
POSTGRES_URL="postgresql://ally:secret@localhost:5432/allyhub" npx prisma migrate dev

# Open Prisma Studio
POSTGRES_URL="postgresql://ally:secret@localhost:5432/allyhub" npx prisma studio
```

---

## 📦 Packages

- `packages/db` — Prisma schema and generated client for Postgres
  - Tables: `EventsRaw`, `Interactions`
  - See `packages/db/README.md` for setup and examples

- `packages/events` — Redis event streaming utilities
  - Streams: `ally:events:ingest:v1:<projectId>:<platform>`, `ally:events:scored:v1:<projectId>`, `ally:events:dlq:v1:<projectId>`
  - Consumer groups for distributed processing

- `packages/intelligence/edgecloud` — EdgeCloud RAG client with Theta provider
  - Build/tests: `yarn workspace @ally/intelligence-edgecloud build | test`

- `packages/scoring-orchestrator` — SDK that combines sentiment, value, uniqueness, and intelligence scoring
  - Weights: sentiment (30%), value (40%), uniqueness (10%), intelligence (20%)
  - See `packages/scoring-orchestrator/README.md` for API and examples

- `packages/uniqueness` — Content uniqueness scoring with vector similarity
  - Backends: memory, pgvector
  - Build: `yarn workspace @ally/uniqueness build`

- `packages/platform-adapters` — Platform-specific adapters
  - Discord adapter for message normalization

TODO:
- **reward-dispatcher**: Near Shade Agent command formatter
- **feedback-loop**: CLI/UI for human-in-the-loop feedback
- **dashboard**: Shared React components
- **intelligence/...**: Adapters to other cloud providers and AI models besides Theta

---

## 🚀 Services (Containers)

Each `services/<name>` folder has its own `Dockerfile`:

- `services/sentiment-service` (FastAPI)
  - Endpoints: `POST /score`, `POST /batch/score`, `POST /analyze`, `GET /healthz`, `GET /readyz`
  - Intelligence analysis with sentiment and entity extraction
  - Config via `infra/.env` (e.g., `SENTIMENT_MODEL_ID`, `SPACY_MODEL`)

- `services/scoring-service` (Node/Express)
  - Endpoints: `POST /v1/score`, `GET /health`, `GET /stats`
  - Redis event streaming with consumer groups
  - Database persistence with Prisma
  - Uses `@ally/scoring-orchestrator` for multi-factor scoring

- `services/ingestion-service` (Node/Express)
  - Discord bot integration
  - Event ingestion and normalization
  - Publishes to Redis streams

TODO:
- **reward-service**: TS listener for reward decisions (Near Shade Agent)
- **dashboard-service**: TS backend + React frontend

---

## 🌐 Frontend Applications (`apps/`)

- **dashboard (TODO)**: React admin UI to: view stats, trends, and flag messages
- **website**: Public Next.js site (static export) deployed on Cloudflare Pages

### Deploying `apps/website`

1. In Cloudflare Pages, connect to this repo, set:
   - **Build command**: `npm --prefix apps/website run build && npm --prefix apps/website run export`
   - **Publish directory**: `apps/website/out`
2. Add `CF_PAGES_TOKEN` & `CF_ACCOUNT_ID` to GitHub Secrets and enable the `website-deploy.yml` workflow.

---

## 📈 CI / CD

- ``: Lint & test all TS packages on push/PR
- ``: Deploy landing page on `main` via Cloudflare Pages

> Future: Add Python lint/test matrix; build & push Docker images to registry; K8s rollout workflows.

---

## 📅 MVP Roadmap (8 Weeks)

1. **Week 1**: Scaffold mono-repo, Docker Compose, CI stub
2. **Week 2**: Theta RAG client service
3. **Week 3**: spaCy sentiment & NER service
4. **Week 4**: Discord adapter & ingestion-service
5. **Week 5**: Scoring-service integration, DB persistence ✅
6. **Week 6**: Config API, context uploader, reward stub
7. **Week 7**: Admin dashboard MVP (Stats, Trends, Data Collection)
8. **Week 8**: E2E testing, fine-tuning pipeline, MVP launch

---

## 🤝 Contributing

1. Fork & branch off `main`
2. Run `yarn install` & `poetry install`
3. Lint, test, and ensure Docker Compose still spins up
4. Submit a PR with description & linked issue

### Creating an Issue (using `.github/ISSUE_TEMPLATE/bug_report.md` and `.github/ISSUE_TEMPLATE/feature_request.md`)

- **Start**: In GitHub, go to Issues → New issue and choose either "Bug report" or "Feature request". The selected template will auto-populate.
- **Fill out sections**:
  - For bug reports (from `.github/ISSUE_TEMPLATE/bug_report.md`): `Summary`, `Steps to Reproduce`, `Expected Behavior`, `Actual Behavior`, `Screenshots or Logs`, `Environment`, `Additional Context`.
  - For feature requests (from `.github/ISSUE_TEMPLATE/feature_request.md`): `Summary`, `Why is this needed?`, `Proposed Solution`, `Alternatives Considered`, `Acceptance Criteria`, `Additional Context`.
- **Labels**: Add appropriate labels (e.g., `type:bug`, `type:enhancement`, `frontend`, `backend`).
- **Good practices**:
  - Use a clear, action-oriented title.
  - Search for duplicates before filing.
  - Link related issues/PRs as needed.

### Opening a Pull Request (using `.github/PULL_REQUEST_TEMPLATE.md`)

- **Prepare**: Create a feature branch from `main`, commit your changes, and push to your fork.
- **Open PR**: In GitHub, open a PR from your branch; the template will prefill the description.
- **Complete the template**:
  - `Closes #<issue-number>` at the top to auto-close the linked issue when merged.
  - Provide a concise `Summary` and enumerate `Changes Made`.
  - Add `Screenshots` for UI changes.
  - Check all items in the `Checklist` after verifying locally (lint/tests/docs as applicable).
- **Standards**:
  - Keep PRs focused and reasonably small.
  - Ensure no secrets or sensitive data are included.
  - Request reviewers and respond to feedback promptly.

---

## 📄 License

This project is licensed for non-commercial use only. You may use, modify, and distribute this code for non-commercial purposes only. Commercial use is strictly prohibited.

For full terms and conditions, please see the [LICENSE](./LICENCE) file.
