import { SentimentService, SentimentResponse } from "./types.js";

export interface SentimentClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export class HttpSentimentClient implements SentimentService {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: SentimentClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async score(text: string): Promise<SentimentResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Sentiment service error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result as SentimentResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Sentiment service timeout after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
