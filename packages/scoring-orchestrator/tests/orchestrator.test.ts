import { jest } from "@jest/globals";
import { AllyScoreOrchestrator } from "../src/orchestrator.js";
import { HttpSentimentClient } from "../src/sentiment-client.js";
import type { SentimentResponse, ValueScoreMetrics } from "../src/types.js";
import type { RagChatResponse } from "@ally/intelligence-edgecloud";

// Mock the EdgeCloud SDK
jest.mock("@ally/intelligence-edgecloud", () => ({
  getEdgeCloud: jest.fn(),
}));

// Note: fetch is mocked globally in setup.ts

describe("AllyScoreOrchestrator", () => {
  let orchestrator: AllyScoreOrchestrator;
  let mockEdgeCloud: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock EdgeCloud
    mockEdgeCloud = {
      ragChat: jest.fn(),
    };
    
    const { getEdgeCloud } = require("@ally/intelligence-edgecloud");
    (getEdgeCloud as jest.Mock).mockReturnValue(mockEdgeCloud);

    // Create orchestrator with test config
    orchestrator = new AllyScoreOrchestrator({
      weights: {
        sentiment: 0.4,
        value: 0.5
      },
      sentimentServiceUrl: "http://localhost:8080",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("score", () => {
    it("should combine sentiment and value scores correctly", async () => {
      // Mock sentiment service response
      const mockSentimentResponse: SentimentResponse = {
        label: "positive",
        score: 0.8, // Will be normalized to (0.8 + 1) / 2 = 0.9
        probs: {
          negative: 0.1,
          neutral: 0.1,
          positive: 0.8,
        },
        entities: [
          { text: "Theta", label: "ORG", start: 0, end: 5 },
          { text: "blockchain", label: "TECH", start: 10, end: 20 },
        ],
        model: {
          sentiment: "cardiffnlp/twitter-roberta-base-sentiment-latest",
          ner: "en_core_web_sm",
        },
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => mockSentimentResponse,
      } as Response);

      // Mock value service response
      const mockValueResponse: RagChatResponse = {
        content: '{"score": 0.5}',
      } as any;

      mockEdgeCloud.ragChat.mockResolvedValue(mockValueResponse);

      // Execute scoring
      const result = await orchestrator.score({
        text: "What is Theta blockchain technology?",
        projectId: "test-project",
      });

      // Verify the result structure
      expect(result).toHaveProperty("finalScore");
      expect(result).toHaveProperty("breakdown");
      expect(result).toHaveProperty("metadata");
      expect(result).toHaveProperty("rawResponses");

      // normalize the scores to 0-1
      const normalizedSentimentScore = (mockSentimentResponse.score + 1) / 2;
      const normalizedValueScore = (JSON.parse(mockValueResponse.content).score + 1) / 2;

      // Verify breakdown
      expect(result.breakdown.sentiment.score).toBe(0.9); // (0.8 + 1) / 2
      expect(result.breakdown.sentiment.label).toBe("positive");
      expect(result.breakdown.sentiment.weight).toBe(0.4);

      expect(result.breakdown.value.score).toBe(normalizedValueScore);
      expect(result.breakdown.value.weight).toBe(0.5);

      // Verify final score calculation
      const expectedFinalScore = 
        ((normalizedSentimentScore * 0.4) +
        (normalizedValueScore * 0.5)) / (0.4 + 0.5);
      
      expect(result.finalScore).toBeCloseTo(expectedFinalScore, 3);

      // Verify metadata
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timestamp).toBeTruthy();
      expect(result.metadata.models.sentiment).toBe("cardiffnlp/twitter-roberta-base-sentiment-latest");

      // Verify raw responses are included
      expect(result.rawResponses.sentiment).toEqual(mockSentimentResponse);
      expect(result.rawResponses.value).toEqual(mockValueResponse);
    });

    it("should handle negative sentiment scores correctly", async () => {
      const mockSentimentResponse: SentimentResponse = {
        label: "negative",
        score: -0.6, // Will be normalized to (-0.6 + 1) / 2 = 0.2
        probs: {
          negative: 0.7,
          neutral: 0.2,
          positive: 0.1,
        },
        entities: [],
        model: {
          sentiment: "cardiffnlp/twitter-roberta-base-sentiment-latest",
          ner: "en_core_web_sm",
        },
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => mockSentimentResponse,
      } as Response);

      mockEdgeCloud.ragChat.mockResolvedValue({ content: '{"score": 0.5}' });

      const result = await orchestrator.score({
        text: "This is terrible",
        projectId: "test-project",
      });

      expect(result.breakdown.sentiment.score).toBe(0.2);
      expect(result.breakdown.sentiment.label).toBe("negative");
    });

    it("should handle API errors gracefully", async () => {
      // Mock sentiment service error
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error("Service unavailable"));

      mockEdgeCloud.ragChat.mockResolvedValue({
        score: 0.5,
      });

      await expect(
        orchestrator.score({
          text: "Test text",
          projectId: "test-project",
        })
      ).rejects.toThrow("Service unavailable");
    });

    it("should handle value service errors gracefully", async () => {
      const mockSentimentResponse: SentimentResponse = {
        label: "neutral",
        score: 0,
        probs: { negative: 0.3, neutral: 0.4, positive: 0.3 },
        entities: [],
        model: { sentiment: "test-model", ner: "test-ner" },
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => mockSentimentResponse,
      } as Response);

      mockEdgeCloud.ragChat.mockRejectedValue(new Error("value service down"));

      await expect(
        orchestrator.score({
          text: "Test text",
          projectId: "test-project",
        })
      ).rejects.toThrow("value service down");
    });
  });

  describe("config management", () => {
    it("should update configuration correctly", () => {
      const newWeights = {
        sentiment: 0.6,
        value: 0.3
      };

      orchestrator.updateConfig({ weights: newWeights });

      const config = orchestrator.getConfig();
      expect(config.weights).toEqual(newWeights);
    });

    it("should validate configuration on update", () => {
      expect(() => {
        orchestrator.updateConfig({
          weights: {
            sentiment: -0.1, // Invalid negative weight
            value: 0.5
          },
        });
      }).toThrow("All weights must be non-negative");
    });
  });
});
