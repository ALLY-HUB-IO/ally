import { getEdgeCloud } from "@ally/intelligence-edgecloud";
import type { RagChatResponse, ChatMessage } from "@ally/intelligence-edgecloud";
import { createUniquenessScorer } from "@ally/uniqueness";
import { 
  ScoringOrchestrator, 
  ScoringRequest, 
  CombinedScoringResult, 
  ScoringConfig,
  PartialScoringConfig,
  SentimentService,
  RagScoreMetrics
} from "./types.js";
import { HttpSentimentClient } from "./sentiment-client.js";
import { ConfigManager } from "./config.js";

export class AllyScoreOrchestrator implements ScoringOrchestrator {
  private configManager: ConfigManager;
  private sentimentService: SentimentService;
  private uniqueness: Promise<any>;
  constructor(config?: PartialScoringConfig) {
    this.configManager = config ? new ConfigManager(config) : ConfigManager.fromEnvironment();
    
    const currentConfig = this.configManager.getConfig();
    this.sentimentService = new HttpSentimentClient({
      baseUrl: currentConfig.sentimentServiceUrl,
      timeoutMs: 10_000,
    });

    this.uniqueness = createUniquenessScorer({ backend: "memory", dim: 128 });
  }

  async score(request: ScoringRequest): Promise<CombinedScoringResult> {
    const startTime = Date.now();
    const config = this.configManager.getConfig();

    // Execute initial API calls in parallel for better performance
    const [sentimentResult, initialValueResp, uniquenessResult] = await Promise.all([
      this.sentimentService.score(request.text),
      this.callRagChatServiceValueScore(request),
      (async () => {
        const scorer = await this.uniqueness;
        const scope = { projectId: request.projectId, platform: "other", channelId: request.context?.messageId } as any;
        return scorer.score(request.text, scope);
      })(),
    ]);

    // Try to extract score from initial response; if invalid, retry with default (no context)
    let chosenValueResp = initialValueResp;
    let extracted = this.extractFirstJsonObject(initialValueResp?.content ?? "");
    let valueScore: number | undefined = (extracted && typeof extracted.score === "number") ? extracted.score : undefined;
    if (!(typeof valueScore === "number" && valueScore >= -1 && valueScore <= 1)) {
      const fallbackResp = await this.callRagChatServiceValueScore(request);
      const fallbackExtracted = this.extractFirstJsonObject(fallbackResp?.content ?? "");
      const fallbackScore = (fallbackExtracted && typeof fallbackExtracted.score === "number") ? fallbackExtracted.score : undefined;
      if (typeof fallbackScore === "number" && fallbackScore >= -1 && fallbackScore <= 1) {
        chosenValueResp = fallbackResp;
        valueScore = fallbackScore;
      }
    }

    // Default to 0 if still missing
    if (typeof valueScore !== "number") valueScore = 0;

    // Calculate individual scores
    const sentimentScore = this.calculateSentimentScore(sentimentResult);
    const valueScoreFinal = this.calculateValueScore(valueScore);

    // Calculate weighted scores
    const weightedSentiment = sentimentScore * config.weights.sentiment;
    const weightedValue = valueScoreFinal * config.weights.value;
    const uniquenessScore = uniquenessResult?.score ?? 0;
    const weightedUniqueness = uniquenessScore * config.weights.uniqueness;

    // Final combined score and normalize to 0-1
    const finalScore = (weightedSentiment + weightedValue + weightedUniqueness) / (config.weights.sentiment + config.weights.value + config.weights.uniqueness);

    const processingTime = Date.now() - startTime;

    return {
      finalScore,
      breakdown: {
        sentiment: {
          score: sentimentScore,
          label: sentimentResult.label,
          weight: config.weights.sentiment,
          weightedScore: weightedSentiment,
        },
        value: {
          score: valueScoreFinal,
          weight: config.weights.value,
          weightedScore: weightedValue,
        },
        uniqueness: {
          score: uniquenessScore,
          weight: config.weights.uniqueness,
          weightedScore: weightedUniqueness,
          maxCosine: uniquenessResult?.maxCosine ?? 0,
        },
      },
      metadata: {
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
        models: {
          sentiment: sentimentResult.model.sentiment,
          value: chosenValueResp.model || "unknown",
        },
      },
      rawResponses: {
        sentiment: sentimentResult,
        value: chosenValueResp,
        uniqueness: {
          score: uniquenessScore,
          maxCosine: uniquenessResult?.maxCosine ?? 0,
        },
      },
    };
  }

  updateConfig(config: PartialScoringConfig): void {
    this.configManager.updateConfig(config);
    
    // Update sentiment service if URL changed
    if (config.sentimentServiceUrl) {
      this.sentimentService = new HttpSentimentClient({
        baseUrl: config.sentimentServiceUrl,
        timeoutMs: 10_000,
      });
    }
  }

  getConfig(): ScoringConfig {
    return this.configManager.getConfig();
  }

  private async callRagService(request: ScoringRequest): Promise<RagChatResponse> {
    const edgeCloud = getEdgeCloud();
    const config = this.configManager.getConfig();

    const messages: ChatMessage[] = [
      { role: "user", content: request.text },
    ];

    return edgeCloud.ragChat({
      projectId: request.projectId,
      messages,
      settings: config.ragSettings,
    });
  }

  private async callRagChatServiceValueScore(request: ScoringRequest): Promise<RagChatResponse> {
    const edgeCloud = getEdgeCloud();
    const config = this.configManager.getConfig();

    const renderPrompt = (template: string, vars: Record<string, string>): string =>
      template.replace(/\$\{(\w+)\}/g, (_m, key) => (key in vars ? vars[key] : ""));

    const defaultValuePrompt =
      'Determine the value that the message provides to other people in the Theta Ecosystem and return a score between -1 (no value or false information) and 1 (a lot of value and true). Return JSON: {"score": <score>}';
    const defaultValueContextPrompt =
      'Determine the value that the message provides based on this context messages ${context} to other people in the Theta Ecosystem and return a score between -1 (no value or false information) and 1 (a lot of value and true). Return JSON: {"score": <score>}';

    const systemTemplate = (request.fullContext)
      ? (config.prompts?.valueScoreContextPrompt ?? defaultValueContextPrompt)
      : (config.prompts?.valueScorePrompt ?? defaultValuePrompt);

    const systemContent = (request.fullContext)
      ? renderPrompt(systemTemplate, { context: request.fullContext })
      : systemTemplate;

    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
      { role: "user", content: request.text },
    ];

    return edgeCloud.ragChat({
      projectId: request.projectId,
      messages,
      settings: config.ragSettings,
    });
  }

  private extractFirstJsonObject(text: string): any | null {
    try { return JSON.parse(text); } catch {}
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const maybe = text.slice(start, end + 1);
      try { return JSON.parse(maybe); } catch {}
    }
    return null;
  }

  private calculateSentimentScore(sentimentResult: any): number {
    // Normalize sentiment score from [-1, 1] to [0, 1]
    return (sentimentResult.score + 1) / 2;
  }


  private calculateValueScore(valueScore: number): number {
    // Normalize token usage (lower is better, so invert)
    return (valueScore + 1) / 2;
  }

//   private calculateEntitiesScore(sentimentResult: any): number {
//     // Score based on number and quality of entities found
//     const entityCount = sentimentResult.entities.length;
    
//     // Give higher scores for more entities, but with diminishing returns
//     if (entityCount === 0) return 0;
//     if (entityCount <= 2) return entityCount * 0.3;
//     if (entityCount <= 5) return 0.6 + ((entityCount - 2) * 0.1);
    
//     return Math.min(1.0, 0.9 + ((entityCount - 5) * 0.02)); // Cap at 1.0
//   }
}

// Factory function for easy instantiation
export function createScoreOrchestrator(config?: PartialScoringConfig): ScoringOrchestrator {
  return new AllyScoreOrchestrator(config);
}
