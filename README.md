# ALLY-Hub

**Automated AI-driven engagement scoring and tokenized rewards platform**

---

## 🚀 Project Overview

ALLY-Hub is a mono-repo for a service-oriented platform that ingests social interactions (e.g., Discord messages), evaluates their value and sentiment using AI, and exposes simple APIs you can integrate with other systems. The repo currently includes:

- A static marketing site (`apps/website`)
- A TypeScript scoring service (`services/scoring-service`) with Redis event streaming
- A Python FastAPI sentiment/NER service (`services/sentiment-service`)
- A TypeScript shade agent service (`services/shade-agent`) for cross-chain transactions
- Shared TypeScript libraries in `packages/`
- PostgreSQL database with Prisma ORM (`packages/db`)

The goal is to create:
- Real-time event ingestion and scoring pipeline
- View real-time stats & trends
- Inspect scored interactions with rationale & sentiment
- Collect data for fine-tuning AI models
- Cross-chain reward payouts via secure shade agent integration

## ⚙️ Configuration System

ALLY-Hub uses a centralized configuration system for managing supported blockchains and social platforms. This eliminates hardcoded values and makes it easy to add new integrations without code changes.

**Key Features:**
- 📁 Centralized config in `infra/supported.json`
- ✅ Runtime validation with clear error messages
- 🔄 Dynamic loading across all services
- 🎯 Type-safe configuration access
- 🚀 Easy addition of new blockchains/platforms

**Supported Blockchains:** Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, NEAR, Theta, Theta Testnet

**Supported Platforms:** Discord, Twitter, Telegram, Reddit

See [`infra/README.md`](infra/README.md) for detailed configuration documentation.

---

## 📁 Repository Structure (current)

```text
ally/
├── apps/
│   └── website/                 # Static public site (HTML/CSS)
├── packages/
│   ├── config/                  # Centralized configuration service
│   ├── db/                      # Prisma schema/client for Postgres
│   ├── events/                  # Redis event streaming utilities
│   ├── intelligence/
│   │   └── edgecloud/           # EdgeCloud RAG client (Theta provider)
│   ├── scoring-orchestrator/    # Combines sentiment + value + uniqueness scoring
│   ├── uniqueness/              # Content uniqueness scoring
│   └── platform-adapters/       # Discord adapter
├── services/
│   ├── scoring-service/         # Node/Express API with Redis event streaming
│   ├── sentiment-service/       # FastAPI service (sentiment + NER)
│   └── shade-agent/            # TypeScript API for cross-chain transactions
├── infra/                       # Configuration files and infrastructure setup
│   ├── supported.json           # Centralized blockchain/platform configuration
│   ├── docker-compose.yml       # Local development environment
│   └── example.env              # Environment variables template
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

# Shade Agent configuration (for cross-chain transactions)
NEAR_NETWORK=mainnet
NEAR_RPC_URL=https://rpc.mainnet.near.org
AGENT_ACCOUNT=your-agent-account.near
NEAR_ACCOUNT_ID=your-agent-account.near
NEAR_SEED_PHRASE=your-12-word-seed-phrase
NEXT_PUBLIC_contractId=ac-proxy.your-agent-account.near
SHADE_AGENT_HTTP_PORT=8090
SHADE_AGENT_TOKEN=your-secret-token
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
- `shade-agent` on http://localhost:8090

### 4. Verify Services

```bash
# Check sentiment service
curl -s http://localhost:8080/healthz

# Check scoring service
curl -s http://localhost:8081/health

# Check ingestion service
curl -s http://localhost:8082/health

# Check shade agent service
curl -s http://localhost:8090/:healthz
```

---

## 🧪 Testing the System

### 1. Test Sentiment Service

```bash
# Test the sentiment analysis endpoint
curl -X POST http://localhost:8080/score \
  -H "Content-Type: application/json" \
  -d '{"text": "This is a great message about Theta Network!"}'
```

Expected response:
```json
{
  "label": "positive",
  "score": 0.973,
  "probs": {"negative": 0.013, "neutral": 0.0, "positive": 0.987},
  "entities": [{"text": "Theta Network", "label": "ORG"}],
  "model": {"sentiment": "BVK97/Discord-NFT-Sentiment", "ner": "en_core_web_sm"}
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

### 4. Test Shade Agent Service

```bash
# Get agent account info
curl http://localhost:8090/api/evm-account

# Get agent balance on Theta testnet
curl http://localhost:8090/api/evm-account?chain=theta-365

# Estimate gas for a transaction
curl -X POST -H "Content-Type: application/json" \
  -d '{"recipientAddress":"0x1234567890123456789012345678901234567890","amount":"1000000000000000000"}' \
  http://localhost:8090/api/transaction/estimate-gas
```

**Note**: The shade agent requires the TEE service to be running locally. See `services/shade-agent/README.md` for complete setup instructions.

### 5. Monitor Real-time Processing

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

### 6. View Database Data

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

- `packages/scoring-orchestrator` — SDK that combines sentiment, value, and uniqueness scoring
  - Weights: sentiment (40%), value (50%), uniqueness (10%)
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
  - Endpoints: `POST /score`, `POST /batch/score`, `GET /healthz`, `GET /readyz`
  - Sentiment analysis with entity extraction
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

- `services/shade-agent` (TypeScript/Hono)
  - Endpoints: `GET /:healthz`, `GET /api/evm-account`, `POST /api/transaction/send`
  - Cross-chain transaction execution (Theta, Ethereum)
  - Chain signature integration with NEAR blockchain
  - Hybrid deployment: API in Docker, TEE service locally

TODO:
- **reward-service**: TS listener for reward decisions (Near Shade Agent)
- **dashboard-service**: TS backend + React frontend
- **shade-agent-cli**: TEE service deployment and management

---

## 🌐 Frontend Applications (`apps/`)

- **dashboard (TODO)**: React admin UI to: view stats, trends, flag messages, and manage cross-chain payouts
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

**Additional**: Shade Agent integration for cross-chain reward payouts ✅

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
