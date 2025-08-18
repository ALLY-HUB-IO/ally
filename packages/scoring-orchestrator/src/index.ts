// Main exports
export { AllyScoreOrchestrator, createScoreOrchestrator } from "./orchestrator.js";
export { HttpSentimentClient } from "./sentiment-client.js";
export { ConfigManager, DEFAULT_CONFIG, DEFAULT_WEIGHTS } from "./config.js";

// Type exports
export type {
  ScoringRequest,
  ScoringWeights,
  ScoringConfig,
  PartialScoringConfig,
  CombinedScoringResult,
  SentimentResponse,
  SentimentEntity,
  RagScoreMetrics,
  ScoringOrchestrator,
  SentimentService,
} from "./types.js";
