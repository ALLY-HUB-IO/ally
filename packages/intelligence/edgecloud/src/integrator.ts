import pLimit from "p-limit";
import { Provider, RagChatRequest, RagChatResponse } from "./models";
import { thetaProvider } from "./providers/theta";

class LRU<K, V> {
  private map = new Map<K, V>();
  constructor(private max = 800) {}
  get(k: K) { const v = this.map.get(k); if (v !== undefined) { this.map.delete(k); this.map.set(k, v); } return v; }
  set(k: K, v: V) { if (this.map.has(k)) this.map.delete(k); this.map.set(k, v);
    if (this.map.size > this.max) { const first = this.map.keys().next(); if (!first.done) this.map.delete(first.value); } }
}

export class EdgeCloudIntegrator {
  private providers = new Map<string, Provider>();
  private current = "theta";
  private limit = pLimit(8);
  private cache = new LRU<string, unknown>(800);

  register(name: string, provider: Provider) {
    this.providers.set(name, provider);
  }
  use(name: string) {
    if (!this.providers.has(name)) throw new Error(`Provider '${name}' not registered`);
    this.current = name;
  }

  async ragChat(req: RagChatRequest, providerName?: string): Promise<RagChatResponse> {
    const name = providerName ?? this.current;
    const p = this.providers.get(name);
    if (!p?.rag) throw new Error(`Provider '${name}' has no RAG service`);
    const key = `rag:${name}:${JSON.stringify(req)}`;
    const cached = this.cache.get(key) as RagChatResponse | undefined;
    if (cached) return cached;
    const result = await this.limit(() => p.rag!.chat(req));
    this.cache.set(key, result);
    return result;
  }
}

// Singleton bootstrap
let _ec: EdgeCloudIntegrator | null = null;
export function getEdgeCloud() {
  if (_ec) return _ec;
  const baseUrl = process.env.TEC_RAG_BASE_URL ?? "http://localhost:8080";
  const apiKey  = process.env.TEC_RAG_API_KEY;
  const theta = thetaProvider({ baseUrl, apiKey, timeoutMs: 20_000 });
  const ec = new EdgeCloudIntegrator();
  ec.register("theta", theta);
  _ec = ec;
  return ec;
}