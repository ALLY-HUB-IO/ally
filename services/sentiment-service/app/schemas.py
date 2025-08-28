from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    text: str = Field(..., description="Input text to analyze")


class BatchScoreRequest(BaseModel):
    texts: List[str] = Field(..., description="List of input texts", min_items=1)


class Entity(BaseModel):
    text: str
    label: str
    start: int
    end: int


class ScoreResponse(BaseModel):
    label: str
    score: float
    probs: Dict[str, float]
    entities: List[Entity]
    model: Dict[str, str]


