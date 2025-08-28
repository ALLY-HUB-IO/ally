import type { IntelligenceService, IntelligenceAnalysis } from './types.js';

export interface IntelligenceClientConfig {
  baseUrl: string;
  timeoutMs?: number;
}

export class HttpIntelligenceClient implements IntelligenceService {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: IntelligenceClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  async analyze(content: string, author?: string, context?: Record<string, any>): Promise<IntelligenceAnalysis> {
    const url = `${this.baseUrl}/analyze`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          author,
          context,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Intelligence service error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      return {
        score: data.score,
        rationale: data.rationale,
        sentiment: data.sentiment,
        entities: data.entities || [],
        model: data.model || {},
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Intelligence service timeout after ${this.timeoutMs}ms`);
        }
        throw error;
      }
      
      throw new Error(`Intelligence service request failed: ${error}`);
    }
  }
}
