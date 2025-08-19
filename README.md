# ALLY-Hub

**Automated AI-driven engagement scoring and tokenized rewards platform**

---

## 🚀 Project Overview

ALLY-Hub is a mono-repo for a service-oriented platform that ingests social interactions (e.g., Discord messages), evaluates their value and sentiment using AI, and exposes simple APIs you can integrate with other systems. The repo currently includes:

- A static marketing site (`apps/website`)
- A TypeScript scoring API (`services/scoring-service`) that calls EdgeCloud
- A Python FastAPI sentiment/NER service (`services/sentiment-service`)
- Shared TypeScript libraries in `packages/`

The goal is to create:
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
│   ├── intelligence/
│   │   └── edgecloud/           # EdgeCloud RAG client (Theta provider)
│   └── scoring-orchestrator/    # Combines sentiment + value scoring
├── services/
│   ├── scoring-service/         # Node/Express API (calls EdgeCloud)
│   └── sentiment-service/       # FastAPI service (sentiment + NER)
├── infra/                       # docker-compose, env example and prompts file
└── .github/                     # CI/CD workflows (if present)
```

---

## 🛠️ Prerequisites

- Node.js v20.x (Yarn 1.x)
- Python 3.11
- Docker & Docker Compose

---

## ⚙️ Getting Started (Local)

1) Clone
```bash
git clone https://github.com/your-org/ally.git
cd ally
```

2) Install workspace dependencies
```bash
yarn install
```

3) Configure environment
```bash
cd infra
cp example.env .env
# edit .env → set TEC_RAG_BASE_URL, TEC_RAG_API_KEY, TEC_CHAT_ID, etc.
```

Key variables (see `infra/example.env`):
- `TEC_RAG_BASE_URL`, `TEC_RAG_API_KEY`, `TEC_CHAT_ID`
- `POSTGRES_URL` (optional for now)
- `SENTIMENT_MODEL_ID`, `SPACY_MODEL`, `HF_TOKEN` (optional)

4) Start local stack
```bash
cd infra
docker compose up --build
```

This brings up:
- `sentiment-service` on http://localhost:8080
- `scoring-service` on http://localhost:8081
- `redis` and `postgres` (optional for future use)

5) Verify
```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8081/health
```

---

## 🔧 Local development (alternatives)

- Run scoring service from workspace (without Docker):
```bash
yarn workspace @ally/intelligence-edgecloud build
yarn workspace scoring-service dev
# → http://localhost:8081
```

- Explore the DB package (optional): see `packages/db/README.md` for Prisma commands.

---

## 📦 Packages

- `packages/intelligence/edgecloud` — EdgeCloud RAG client with Theta provider. Includes simple concurrency control and in-memory caching.
  - Build/tests: `yarn workspace @ally/intelligence-edgecloud build | test`

- `packages/scoring-orchestrator` — SDK that combines sentiment and value scoring, applies weights, and returns a single score with breakdowns.
  - See `packages/scoring-orchestrator/README.md` for API and examples.

- `packages/db` — Prisma schema and generated client for Postgres, shared across services.
  - See `packages/db/README.md` for setup, migrations, and examples.

TODO:
- **reward-dispatcher**: Near Shade Agent command formatter
- **feedback-loop**: CLI/UI for human-in-the-loop feedback
- **dashboard**: Shared React components
- **platform-adapters**: Normalization for Discord, Telegram, X
- **intelligence/...**: Adapters to other cloud providers and AI models besides Theta

---

## 🚀 Services (Containers)

Each `services/<name>` folder has its own `Dockerfile`:

- `services/sentiment-service` (FastAPI)
  - Endpoints: `POST /score`, `POST /batch/score`, `GET /healthz`, `GET /readyz`
  - Config via `infra/.env` (e.g., `SENTIMENT_MODEL_ID`, `SPACY_MODEL`)
  - See `services/sentiment-service/README.md`

- `services/scoring-service` (Node/Express)
  - Endpoints: `POST /v1/score`, jobs under `/v1/score-jobs`, `GET /health`
  - Uses `@ally/intelligence-edgecloud` to call EdgeCloud
  - See `services/scoring-service/README.md`

TODO:
- **ingestion-service**: boots adapters via TS
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
5. **Week 5**: Scoring-service integration, DB persistence
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
