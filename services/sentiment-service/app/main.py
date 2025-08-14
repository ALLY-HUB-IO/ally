import os
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .loaders import load_hf_sentiment, load_spacy
from .inference import run_single, run_batch
from .schemas import ScoreRequest, BatchScoreRequest, ScoreResponse


app = FastAPI(title="Ally Sentiment Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


sent_pipeline = None
ner_nlp = None


@app.on_event("startup")
def _load() -> None:
    global sent_pipeline, ner_nlp
    sent_pipeline = load_hf_sentiment()
    ner_nlp = load_spacy()


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> dict:
    return {"ready": sent_pipeline is not None and ner_nlp is not None}


@app.post("/score", response_model=ScoreResponse)
def score(payload: ScoreRequest) -> ScoreResponse:
    if sent_pipeline is None or ner_nlp is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    out = run_single(sent_pipeline, ner_nlp, text)
    out["model"] = {
        "sentiment": os.environ.get("SENTIMENT_MODEL_ID", ""),
        "ner": os.environ.get("SPACY_MODEL", "en_core_web_sm"),
    }
    return out


@app.post("/batch/score", response_model=List[ScoreResponse])
def batch_score(payload: BatchScoreRequest) -> List[ScoreResponse]:
    if sent_pipeline is None or ner_nlp is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    texts = payload.texts or []
    if not isinstance(texts, list) or not texts:
        raise HTTPException(status_code=400, detail="texts[] is required")

    try:
        max_batch = int(os.environ.get("MAX_BATCH", "64"))
    except ValueError:
        max_batch = 64

    if len(texts) > max_batch:
        raise HTTPException(status_code=413, detail=f"Max batch {max_batch}")

    outputs = run_batch(sent_pipeline, ner_nlp, texts)
    for out in outputs:
        out["model"] = {
            "sentiment": os.environ.get("SENTIMENT_MODEL_ID", ""),
            "ner": os.environ.get("SPACY_MODEL", "en_core_web_sm"),
        }
    return outputs


