import { jest } from "@jest/globals";
import { HttpSentimentClient } from "../src/sentiment-client.js";
import type { SentimentResponse } from "../src/types.js";

// Note: fetch is mocked globally in setup.ts

describe("HttpSentimentClient", () => {
  let client: HttpSentimentClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new HttpSentimentClient({
      baseUrl: "http://localhost:8080",
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("score", () => {
    it("should make correct API call and return response", async () => {
      const mockResponse: SentimentResponse = {
        label: "positive",
        score: 0.8,
        probs: {
          negative: 0.1,
          neutral: 0.1,
          positive: 0.8,
        },
        entities: [
          { text: "Theta", label: "ORG", start: 0, end: 5 },
        ],
        model: {
          sentiment: "cardiffnlp/twitter-roberta-base-sentiment-latest",
          ner: "en_core_web_sm",
        },
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.score("Theta is amazing!");

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:8080/score",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: "Theta is amazing!" }),
          signal: expect.any(AbortSignal),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it("should handle HTTP errors", async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(client.score("Test text")).rejects.toThrow(
        "Sentiment service error: 500 Internal Server Error"
      );
    });

    it("should handle network errors", async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error("Network error"));

      await expect(client.score("Test text")).rejects.toThrow("Network error");
    });

    it("should handle timeout", async () => {
      const client = new HttpSentimentClient({
        baseUrl: "http://localhost:8080",
        timeoutMs: 100, // Very short timeout
      });

      // Mock a slow response that never resolves within timeout
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(() => 
        new Promise((resolve, reject) => {
          // Simulate AbortSignal behavior
          setTimeout(() => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          }, 50); // Reject before timeout
        }) as unknown as Promise<Response>
      );

      await expect(client.score("Test text")).rejects.toThrow(
        "Sentiment service timeout after 100ms"
      );
    }, 1000); // Add test timeout

    it("should trim trailing slash from baseUrl", async () => {
      const clientWithSlash = new HttpSentimentClient({
        baseUrl: "http://localhost:8080/",
      });

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({ label: "neutral", score: 0, probs: {}, entities: [], model: {} }),
      } as Response);

      await clientWithSlash.score("Test");

      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:8080/score",
        expect.any(Object)
      );
    });
  });
});
