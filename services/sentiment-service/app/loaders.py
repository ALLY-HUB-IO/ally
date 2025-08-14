import os
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


