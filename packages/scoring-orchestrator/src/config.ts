import { ScoringConfig, ScoringWeights, PartialScoringConfig, Prompts } from "./types.js";
import fs from "node:fs";
import path from "node:path";

// Default configuration
export const DEFAULT_WEIGHTS: ScoringWeights = {
  sentiment: 0.4, // 40% weight for sentiment analysis
  value: 0.5,      // 50% weight for Value Score
  uniqueness: 0.1, // 10% weight for Uniqueness Score
};

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: DEFAULT_WEIGHTS,
  sentimentServiceUrl: process.env.SENTIMENT_SERVICE_URL || "http://localhost:8080",
  ragSettings: {
    temperature: 0.3,
    max_tokens: 1024,
  },
  prompts: undefined,
};

/**
 * Configuration manager for scoring orchestrator
 * Supports loading from environment variables, files, or programmatic updates
 */
export class ConfigManager {
  private config: ScoringConfig;

  constructor(initialConfig?: PartialScoringConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...initialConfig,
      weights: {
        ...DEFAULT_CONFIG.weights,
        ...initialConfig?.weights,
      },
      ragSettings: {
        ...DEFAULT_CONFIG.ragSettings,
        ...initialConfig?.ragSettings,
      },
      prompts: initialConfig?.prompts ?? DEFAULT_CONFIG.prompts,
    };

    this.validateConfig();
  }

  getConfig(): ScoringConfig {
    return {
      ...this.config,
      weights: { ...this.config.weights },
      ragSettings: this.config.ragSettings ? { ...this.config.ragSettings } : undefined,
    };
  }

  updateConfig(updates: PartialScoringConfig): void {
    this.config = {
      ...this.config,
      ...updates,
      weights: {
        ...this.config.weights,
        ...updates.weights,
      },
      ragSettings: {
        ...this.config.ragSettings,
        ...updates.ragSettings,
      },
    };

    this.validateConfig();
  }

  updateWeights(weights: Partial<ScoringWeights>): void {
    this.config.weights = {
      ...this.config.weights,
      ...weights,
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    const { weights } = this.config;

    // Ensure weights are non-negative
    if (weights.sentiment < 0 || weights.value < 0 || weights.uniqueness < 0) {
      throw new Error("All weights must be non-negative");
    }

    // Ensure weights sum to a reasonable value (warn if not close to 1.0)
    const totalWeight = weights.sentiment + weights.value + weights.uniqueness;
    if (totalWeight === 0) {
      throw new Error("At least one weight must be greater than 0");
    }

    // Warn if weights don't sum to 1.0 (but allow it for flexibility)
    if (Math.abs(totalWeight - 1.0) > 0.1) {
      console.warn(`Scoring weights sum to ${totalWeight.toFixed(3)}, consider normalizing to 1.0`);
    }

    // Validate URLs
    try {
      new URL(this.config.sentimentServiceUrl);
    } catch {
      throw new Error(`Invalid sentiment service URL: ${this.config.sentimentServiceUrl}`);
    }
  }

  /**
   * Load configuration from environment variables
   * Environment variables override default config
   */
  static fromEnvironment(): ConfigManager {
    const envConfig: PartialScoringConfig = {};

    // Load weights from environment
    const sentimentWeight = process.env.SCORING_WEIGHT_SENTIMENT;
    const valueWeight = process.env.SCORING_WEIGHT_VALUE;
    const uniquenessWeight = process.env.SCORING_WEIGHT_UNIQUENESS;

    const weights: Partial<ScoringWeights> = {};
    if (sentimentWeight) weights.sentiment = parseFloat(sentimentWeight);
    if (valueWeight) weights.value = parseFloat(valueWeight);
    if (uniquenessWeight) weights.uniqueness = parseFloat(uniquenessWeight);
    
    if (Object.keys(weights).length > 0) {
      envConfig.weights = weights;
    }

    // Load service URL
    if (process.env.SENTIMENT_SERVICE_URL) {
      envConfig.sentimentServiceUrl = process.env.SENTIMENT_SERVICE_URL;
    }

    // Load RAG settings
    const ragTemp = process.env.RAG_TEMPERATURE;
    const ragMaxTokens = process.env.RAG_MAX_TOKENS;

    if (ragTemp || ragMaxTokens) {
      envConfig.ragSettings = {};
      if (ragTemp) envConfig.ragSettings.temperature = parseFloat(ragTemp);
      if (ragMaxTokens) envConfig.ragSettings.max_tokens = parseInt(ragMaxTokens, 10);
    }

    // Load prompts from infra/prompts.json if present
    try {
      const repoRoot = process.cwd();
      const promptFile = path.resolve(repoRoot, "infra", "prompts.json");
      if (fs.existsSync(promptFile)) {
        const raw = fs.readFileSync(promptFile, "utf-8");
        const parsed = JSON.parse(raw) as Partial<Prompts>;
        envConfig.prompts = parsed;
      }
    } catch (err) {
      console.warn("Failed to load prompts from infra/prompts.json:", (err as Error).message);
    }

    return new ConfigManager(envConfig);
  }
}
