from typing import Dict, List


THREE_CLASS_LABELS = {"negative", "neutral", "positive"}


def softmax_to_three_from_label_and_score(raw_label: str, score: float) -> Dict[str, float]:
    # Fallback if only label+score provided; produce one-hot-like distribution
    if raw_label.upper() in {"NEGATIVE", "LABEL_0"}:
        return {"negative": float(score), "neutral": 0.0, "positive": 1.0 - float(score)}
    if raw_label.upper() in {"POSITIVE", "LABEL_1", "LABEL_2"}:
        # Assume binary (pos/neg) when label_1 or label_2 encountered without probs
        neg = 1.0 - float(score)
        return {"negative": neg, "neutral": 0.0, "positive": float(score)}
    # Default neutral
    return {"negative": 0.0, "neutral": 1.0, "positive": 0.0}


def normalize_to_three_classes(raw_label: str, raw_scores: Dict) -> Dict[str, float]:
    # Try to capture common model label schemes
    label = (raw_label or "").upper()

    # If model returns full distribution in "scores" or similar, try mapping
    # HuggingFace pipeline often returns only label + score; some models return list of dicts
    # Here, we rely on label conventions
    if label in {"NEGATIVE", "POSITIVE", "NEUTRAL"}:
        # Binary or ternary could be present; if neutral not possible, set to 0
        score_val = float(raw_scores.get("score", 1.0))
        if label == "NEGATIVE":
            return {"negative": score_val, "neutral": 0.0, "positive": 1.0 - score_val}
        if label == "POSITIVE":
            return {"negative": 1.0 - score_val, "neutral": 0.0, "positive": score_val}
        # NEUTRAL
        # When explicitly neutral, split remaining mass across ends equally
        remaining = max(0.0, 1.0 - score_val)
        return {"negative": remaining / 2.0, "neutral": score_val, "positive": remaining / 2.0}

    # CardiffNLP: LABEL_0=negative, LABEL_1=neutral, LABEL_2=positive
    if label in {"LABEL_0", "LABEL_1", "LABEL_2"}:
        score_val = float(raw_scores.get("score", 1.0))
        if label == "LABEL_0":
            return {"negative": score_val, "neutral": 0.0, "positive": 1.0 - score_val}
        if label == "LABEL_1":
            remaining = max(0.0, 1.0 - score_val)
            return {"negative": remaining / 2.0, "neutral": score_val, "positive": remaining / 2.0}
        # LABEL_2
        return {"negative": 1.0 - score_val, "neutral": 0.0, "positive": score_val}

    # Star-based models (e.g., nlptown 1-5 stars). Map stars to distribution heuristically
    if label.startswith("\u2605") or label.startswith("STAR") or label.startswith("LABEL_"):
        # If provided as LABEL_0..LABEL_4, map to stars 1..5
        try:
            idx = int(label.split("_")[-1])
            stars = idx + 1 if 0 <= idx <= 4 else 3
        except Exception:
            stars = 3
        # Convert stars to neg/neu/pos
        if stars <= 2:
            neg = 1.0
            neu = 0.0
            pos = 0.0
        elif stars == 3:
            neg = 0.0
            neu = 1.0
            pos = 0.0
        else:
            neg = 0.0
            neu = 0.0
            pos = 1.0
        return {"negative": neg, "neutral": neu, "positive": pos}

    # Fallback
    return softmax_to_three_from_label_and_score(raw_label, float(raw_scores.get("score", 1.0)))


def score_from_probs(probs: Dict[str, float]) -> float:
    return float(probs["positive"] - probs["negative"])


def run_single(sent_pipeline, ner_nlp, text: str) -> Dict:
    sent = sent_pipeline(text)[0]
    probs = normalize_to_three_classes(sent.get("label", ""), sent)
    doc = ner_nlp(text)
    ents = [
        {
            "text": ent.text,
            "label": ent.label_,
            "start": ent.start_char,
            "end": ent.end_char,
        }
        for ent in doc.ents
    ]
    return {
        "label": max(probs, key=probs.get),
        "score": score_from_probs(probs),
        "probs": probs,
        "entities": ents,
    }


def run_batch(sent_pipeline, ner_nlp, texts: List[str]) -> List[Dict]:
    # Use pipeline batching for speed; ensure truncation handled by pipeline
    sent_outputs = sent_pipeline(texts)
    results: List[Dict] = []
    for text, sent in zip(texts, sent_outputs):
        if isinstance(sent, list) and len(sent) > 0:
            sent = sent[0]
        probs = normalize_to_three_classes(sent.get("label", ""), sent)
        doc = ner_nlp(text)
        ents = [
            {
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char,
            }
            for ent in doc.ents
        ]
        results.append(
            {
                "label": max(probs, key=probs.get),
                "score": score_from_probs(probs),
                "probs": probs,
                "entities": ents,
            }
        )
    return results


