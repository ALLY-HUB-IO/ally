import os
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .loaders import load_hf_sentiment, load_spacy, load_spacy_with_custom_entities
from .inference import run_single, run_batch
from .schemas import ScoreRequest, BatchScoreRequest, ScoreResponse, AnalyzeRequest, AnalyzeResponse


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
    # Prefer custom entities if provided via CUSTOM_ENTITIES_FILE
    if os.environ.get("CUSTOM_ENTITIES_FILE"):
        ner_nlp = load_spacy_with_custom_entities()
    else:
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


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    if sent_pipeline is None or ner_nlp is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet")

    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    # Run sentiment analysis
    sentiment_result = run_single(sent_pipeline, ner_nlp, content)
    
    # Calculate overall score (normalize sentiment to 0-1 range)
    sentiment_score = (sentiment_result["score"] + 1) / 2  # Convert from [-1, 1] to [0, 1]
    
    # Generate rationale based on sentiment and entities
    entity_count = len(sentiment_result["entities"])
    sentiment_label = sentiment_result["label"]
    
    if sentiment_score > 0.7:
        rationale = f"Positive sentiment ({sentiment_label}) with {entity_count} entities identified"
    elif sentiment_score < 0.3:
        rationale = f"Negative sentiment ({sentiment_label}) with {entity_count} entities identified"
    else:
        rationale = f"Neutral sentiment ({sentiment_label}) with {entity_count} entities identified"
    
    if entity_count > 0:
        entity_names = [e["text"] for e in sentiment_result["entities"][:3]]  # Top 3 entities
        rationale += f". Key entities: {', '.join(entity_names)}"
    
    return AnalyzeResponse(
        score=sentiment_score,
        rationale=rationale,
        sentiment=sentiment_label,
        entities=sentiment_result["entities"],
        model={
            "sentiment": os.environ.get("SENTIMENT_MODEL_ID", ""),
            "ner": os.environ.get("SPACY_MODEL", "en_core_web_sm"),
        }
    )


