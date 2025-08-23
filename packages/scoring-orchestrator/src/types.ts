import { ChatMessage, RagChatResponse } from "@ally/intelligence-edgecloud";

// Sentiment service response types
export interface SentimentEntity {
  text: string;
  label: string;
  start: number;
  end: number;
}

export interface SentimentResponse {
  label: "negative" | "neutral" | "positive";
  score: number; // Range: [-1, 1] where P(positive) - P(negative)
  probs: {
    negative: number;
    neutral: number;
    positive: number;
  };
  entities: SentimentEntity[];
  model: {
    sentiment: string;
    ner: string;
  };
}

// Orchestrator request/response types
export interface ScoringRequest {
  text: string;
  projectId: string; // For EdgeCloud RAG
  context?: {
    userId?: string;
    messageId?: string;
    timestamp?: string;
  };
  fullContext?: string;
}

export interface ScoringWeights {
  sentiment: number; // Weight for sentiment score
  value: number; // Weight for value score
  uniqueness: number; // Weight for uniqueness score
}

export interface ScoringConfig {
  weights: ScoringWeights;
  sentimentServiceUrl: string;
  ragSettings?: {
    temperature?: number;
    max_tokens?: number;
  };
  prompts?: Partial<Prompts>;
}

export interface PartialScoringConfig {
  weights?: Partial<ScoringWeights>;
  sentimentServiceUrl?: string;
  ragSettings?: {
    temperature?: number;
    max_tokens?: number;
  };
  prompts?: Partial<Prompts>;
}

export interface RagScoreMetrics {
  relevance: number; // 0-1 based on sources found
  confidence: number; // 0-1 based on response quality
  tokenUsage: number; // Normalized token count
  score: number; // Combined RAG score
}

export interface ValueScoreMetrics {
  score: number; // 0-1 based on value score
}

export interface UniquenessScoreMetrics {
  score: number; // 0-1 based on uniqueness score
  maxCosine: number; // Maximum cosine similarity score
}

export interface CombinedScoringResult {
  finalScore: number; // Weighted combination of all scores
  breakdown: {
    sentiment: {
      score: number;
      label: "negative" | "neutral" | "positive";
      weight: number;
      weightedScore: number;
    };
    value: {
      score: number;
      weight: number;
      weightedScore: number;
    };
    uniqueness: {
      score: number;
      weight: number;
      weightedScore: number;
      maxCosine: number;
    };
  };
  metadata: {
    processingTimeMs: number;
    timestamp: string;
    models: {
      sentiment: string;
      value: string;
    };
  };
  rawResponses: {
    sentiment: SentimentResponse;
    value: RagChatResponse;
    uniqueness: UniquenessScoreMetrics;
  };
}

// Service interfaces
export interface SentimentService {
  score(text: string): Promise<SentimentResponse>;
}

export interface ScoringOrchestrator {
  score(request: ScoringRequest): Promise<CombinedScoringResult>;
  updateConfig(config: PartialScoringConfig): void;
  getConfig(): ScoringConfig;
}

// Prompts configuration
export interface Prompts {
  valueScorePrompt: string;
  valueScoreContextPrompt: string;
}
