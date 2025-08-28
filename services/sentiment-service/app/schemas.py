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


class AnalyzeRequest(BaseModel):
    content: str = Field(..., description="Content to analyze")
    author: Optional[str] = Field(None, description="Author identifier")
    context: Optional[Dict[str, str]] = Field(None, description="Additional context")


class AnalyzeResponse(BaseModel):
    score: float = Field(..., description="Overall score between 0 and 1")
    rationale: str = Field(..., description="Explanation of the score")
    sentiment: str = Field(..., description="Sentiment label")
    entities: List[Entity] = Field(default_factory=list, description="Named entities found")
    model: Dict[str, str] = Field(..., description="Model information")


