import os
import json
import logging
from typing import Optional

import spacy
from transformers import (
    pipeline,
    AutoTokenizer,
    AutoModelForSequenceClassification,
)
from huggingface_hub import login


logger = logging.getLogger(__name__)


def _get_device() -> int:
    device_pref = os.environ.get("INFERENCE_DEVICE", "cpu").lower()
    if device_pref == "cuda":
        try:
            import torch

            return 0 if torch.cuda.is_available() else -1
        except Exception:
            return -1
    return -1


def load_hf_sentiment():
    model_id = os.environ.get(
        "SENTIMENT_MODEL_ID",
        "cardiffnlp/twitter-roberta-base-sentiment-latest",
    )
    token = os.environ.get("HF_TOKEN")
    if token:
        try:
            login(token)
        except Exception:
            logger.warning("HF login failed; proceeding without auth")

    tokenizer = AutoTokenizer.from_pretrained(model_id, use_auth_token=bool(token))
    model = AutoModelForSequenceClassification.from_pretrained(
        model_id, use_auth_token=bool(token)
    )
    device = _get_device()
    return pipeline(
        "sentiment-analysis",
        model=model,
        tokenizer=tokenizer,
        device=device,
        truncation=True,
    )


def load_spacy():
    model_name = os.environ.get("SPACY_MODEL", "en_core_web_sm")
    return spacy.load(model_name)


def load_spacy_with_custom_entities():
    """Load spaCy model and optionally augment with EntityRuler from JSONL.

    Reads CUSTOM_ENTITIES_FILE from env. If present and readable, loads patterns
    and inserts an EntityRuler BEFORE the statistical NER so custom matches are kept.
    """
    model_name = os.environ.get("SPACY_MODEL", "en_core_web_sm")
    nlp = spacy.load(model_name)

    custom_file_path = os.environ.get("CUSTOM_ENTITIES_FILE", "").strip()
    if not custom_file_path:
        return nlp

    try:
        from spacy.pipeline import EntityRuler

        ruler = nlp.add_pipe(
            "entity_ruler",
            before="ner",
            config={"phrase_matcher_attr": "LOWER"},
        )
        patterns = []
        if os.path.exists(custom_file_path):
            with open(custom_file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        patterns.append(json.loads(line))
                    except Exception:
                        logger.warning("Skipping invalid JSONL line in %s", custom_file_path)
            if patterns:
                ruler.add_patterns(patterns)
                logger.info("Loaded %d custom entity patterns from %s", len(patterns), custom_file_path)
            else:
                logger.warning("No valid patterns found in %s", custom_file_path)
        else:
            logger.warning("CUSTOM_ENTITIES_FILE not found: %s", custom_file_path)
    except Exception as exc:
        logger.warning("Failed to load custom entities: %s", exc)

    return nlp


