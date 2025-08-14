### Ally Sentiment Service

FastAPI microservice that performs:
- Named-Entity Recognition (NER) with spaCy
- Sentiment scoring with a pluggable Hugging Face model

It exposes HTTP endpoints to score single texts or batches, returning:
- label: negative | neutral | positive
- score: continuous value in [-1, 1] computed as P(positive) - P(negative)
- probs: normalized class probabilities
- entities: spaCy NER spans with labels
- model: which sentiment and NER models were used

## Endpoints
- POST `/score`
- POST `/batch/score`
- GET `/healthz`
- GET `/readyz`

## Environment variables
These are read from `infra/.env` when running via Docker Compose.

```env
# HF model selection
SENTIMENT_MODEL_ID=cardiffnlp/twitter-roberta-base-sentiment-latest
# Alternative examples:
# SENTIMENT_MODEL_ID=finiteautomata/bertweet-base-sentiment-analysis
# SENTIMENT_MODEL_ID=distilbert-base-uncased-finetuned-sst-2-english

# spaCy model (installed at build)
SPACY_MODEL=en_core_web_sm

# Optional: private models
HF_TOKEN=

# Performance
INFERENCE_DEVICE=cpu        # cpu | cuda
MAX_BATCH=64
LOG_LEVEL=info
```

## Supported/known-good sentiment models
You can set any compatible HF text classification model. Examples:
- `cardiffnlp/twitter-roberta-base-sentiment-latest`
- `BVK97/Discord-NFT-Sentiment`
- `distilbert-base-uncased-finetuned-sst-2-english`
- `nlptown/bert-base-multilingual-uncased-sentiment` (star ratings → mapped)
- `finiteautomata/bertweet-base-sentiment-analysis`
- `siebert/sentiment-roberta-large-english`
- `bhadresh-savani/distilbert-base-uncased-emotion` (mapped to 3-way)

Note: Models with 2-way outputs (positive/negative) are mapped with neutral=0; 5-star models are heuristically mapped to negative/neutral/positive.

## How to run (Docker Compose)
1) Copy and edit env file
```bash
cd infra
cp example.env .env
# edit .env to set SENTIMENT_MODEL_ID, optional HF_TOKEN, etc.
```

2) Build & start only this service
```bash
docker compose build sentiment
docker compose up -d sentiment
docker compose logs -f sentiment
```

3) Health and readiness
```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/readyz
```

`/readyz` returns true once the HF model and spaCy model are loaded.

## Usage examples
Single text
```bash
curl -s -X POST http://localhost:8080/score \
  -H "Content-Type: application/json" \
  -d '{"text":"Theta just shipped a huge upgrade—bullish!"}' | jq
```

Batch
```bash
curl -s -X POST http://localhost:8080/batch/score \
  -H "Content-Type: application/json" \
  -d '{"texts":["Love this","Meh.","This is terrible."]}' | jq
```

Typical response shape
```json
{
  "label": "positive",
  "score": 0.87,
  "probs": {"negative":0.03, "neutral":0.10, "positive":0.87},
  "entities": [{"text":"Theta","label":"ORG","start":0,"end":5}],
  "model": {"sentiment":"cardiffnlp/...","ner":"en_core_web_sm"}
}
```

## Changing models
- Edit `SENTIMENT_MODEL_ID` in `infra/.env`.
- Rebuild/restart the container:
```bash
cd infra
docker compose build sentiment
docker compose up -d sentiment
```

## Implementation notes
- Sentiment uses `transformers.pipeline(task="sentiment-analysis")`.
- Probabilities normalized to three classes; final score = P(pos) - P(neg).
- NER uses `spaCy` (`SPACY_MODEL`, default `en_core_web_sm`).
- Model cache mounted at `/hf-cache` to speed restarts.

## Security & licensing
- If using private HF models, set `HF_TOKEN` via secrets (not committed).
- Dependencies are pinned; rebuild periodically for CVE fixes.
- The project license applies here as well; see repo root `LICENCE`.


