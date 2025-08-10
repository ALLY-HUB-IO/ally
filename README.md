# ALLY-Hub

**Automated AI-driven engagement scoring and tokenized rewards platform**

---

## 🚀 Project Overview

ALLY-Hub is a mono-repo for building a service-oriented platform that ingests social interactions (e.g., Discord messages), uses AI to evaluate their value and sentiment, and dispatches tokenized rewards via Near Shade Agents. It provides both a landing page (website) and an admin dashboard for project owners to:

- View real-time stats & trends
- Inspect scored interactions with rationale & sentiment
- Collect data for fine-tuning AI models

---

## 📁 Repository Structure (Example for now)

```text
ally/
├── apps/
│   ├── dashboard/           # React admin UI (Stats, Trends, Data Collection)
│   └── website/             # Public Next.js marketing site (Cloudflare Pages)
├── packages/               # Shared libraries (TS & Python)
│   ├── intelligence/        # AI logic (RAG, sentiment, config)
│   │   ├── rag-evaluator/
│   │   ├── sentiment-reach/
│   │   └── config-service/
│   ├── identity/           # User resolution & profile linking
│   ├── platform-adapters/  # Discord, Telegram, X normalizers
│   ├── scoring-orchestrator/# Composes RAG + sentiment + weights
│   ├── reward-dispatcher/  # Near Shade Agent integration logic
│   ├── feedback-loop/      # CLI/UI for true-value feedback
│   ├── api-gateway/        # OpenAPI routes & auth middleware
│   └── dashboard/          # Shared UI components for admin dashboard
├── services/               # Dockerized microservices
│   ├── ingestion-service/  # Boots platform adapters, publishes events
│   ├── scoring-service/    # Consumes events, calls AI, writes Postgres
│   ├── intelligence-service/# Hosts FastAPI AI endpoints
│   ├── reward-service/     # Listens scored events, dispatches rewards
│   └── dashboard-service/  # Serves dashboard backend + frontend
├── infra/                  # K8s manifests, Helm, Terraform scripts
├── projects/               # Project-specific context & config
│   └── <project-name>/     # vector-store docs + config.yaml
├── docker-compose.yml      # Local dev orchestration
└── .github/                # CI & CD workflows
```

---

## 🛠️ Prerequisites

- **Node.js** v20.x (Yarn 1.x or npm 7+)
- **Python** 3.11
- **Docker** & **Docker Compose**
- **Cloudflare Pages** account (for `apps/website`)

---

## ⚙️ Getting Started (Local Development)

1. **Clone the repo**

   ```bash
   git clone https://github.com/your-org/ally.git
   cd ally
   ```

2. **Install dependencies**

   ```bash
   # Node.js workspaces
   yarn install  # or npm install

   # Python packages (optional, if editing AI services)
   cd packages/intelligence/rag-evaluator && poetry install
   cd ../sentiment-reach && poetry install
   cd ../config-service    && poetry install
   cd ../../../
   ```

3. **Environment variables**

   - Create a `.env` file in `infra/`:
     ```ini
     THETA_API_KEY=your_theta_sandbox_key
     REDIS_URL=redis://redis:6379
     POSTGRES_URL=postgresql://ally:secret@postgres/allyhub
     ```

4. **Start local stack**

   ```bash
   cd infra
   docker-compose up --build
   ```

   This brings up:

   - PostgreSQL (allyhub database)
   - Redis (queues & cache)
   - FAISS stub
   - All service containers (ingestion, intelligence, scoring, reward, dashboard)

5. **Verify**

   - Dashboard: [http://localhost:3000](http://localhost:3000)
   - Public website (optional): run separately: `cd apps/website && yarn build && yarn export && serve out`

---

## 🚧 Packages (Libraries)

### `packages/intelligence`

- **rag-evaluator**: Theta EdgeCloud RAG client, caching
- **sentiment-reach**: spaCy NER + sentiment model stub
- **config-service**: YAML/DB-backed project config loader & CRUD API

### `packages/platform-adapters`

- Normalization for Discord, Telegram, X
- Emits events to Redis Streams

### Business logic

- **scoring-orchestrator**: merges value & sentiment → final score
- **reward-dispatcher**: Near Shade Agent command formatter
- **feedback-loop**: CLI/UI for human-in-the-loop feedback
- **api-gateway**: Express/Koa routes, auth middleware
- **dashboard**: Shared React components

---

## 🚀 Services (Containers)

Each `services/<name>` folder has its own `Dockerfile`:

- **ingestion-service**: boots adapters via TS
- **scoring-service**: TypeScript consumer of Redis Streams → DB
- **intelligence-service**: Python FastAPI exposing `/evaluate` & `/analyze`
- **reward-service**: TS listener for reward decisions
- **dashboard-service**: TS backend + React frontend

They each import their dependencies from `packages/` (via pip `path` deps or Yarn workspaces).

---

## 🌐 Frontend Applications (`apps/`)

- **dashboard**: React admin UI to: view stats, trends, and flag messages
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

### Creating an Issue (using `.github/ISSUE_TEMPLATE.md`)

- **Start**: In GitHub, go to Issues → New issue. The template content will auto-populate.
- **Fill out sections**: `Summary`, `Current Behavior`, `Desired Behavior`, `Steps to Reproduce` (if bug), `Acceptance Criteria`, `Additional Notes`.
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

