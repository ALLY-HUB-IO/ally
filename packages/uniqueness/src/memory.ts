import type { Neighbor, UniquenessResult, UniquenessScope, UniquenessScorer } from "./types.js";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function shingle(text: string, n = 3): string[] {
  const tokens = normalizeWhitespace(text).toLowerCase().split(/\W+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

function jaccard(setA: Set<string>, setB: Set<string>): number {
  let inter = 0;
  for (const v of setA) if (setB.has(v)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Todo: Placeholder embedding generator (deterministic, not semantic). Replace in production.
function cheapDeterministicEmbedding(text: string, dim = 128): Float32Array {
  const out = new Float32Array(dim);
  let seed = 2166136261;
  const s = normalizeWhitespace(text);
  for (let i = 0; i < s.length; i++) {
    seed ^= s.charCodeAt(i);
    seed += (seed << 1) + (seed << 4) + (seed << 7) + (seed << 8) + (seed << 24);
    const idx = (seed >>> 0) % dim;
    out[idx] += 1;
  }
  return out;
}

interface MemoryItem {
  messageId: string;
  scopeKey: string;
  embedding: Float32Array;
  shingles: Set<string>;
  createdAt: number;
}

function makeScopeKey(scope: UniquenessScope): string {
  const w = scope.windowDays ?? 30;
  return [scope.projectId, scope.platform, scope.channelId ?? "*", scope.authorId ?? "*", `w:${w}`].join("|");
}

export class MemoryUniquenessScorer implements UniquenessScorer {
  private items: MemoryItem[] = [];
  private readonly dim: number;

  constructor(dim = 128) {
    this.dim = dim;
  }

  async score(text: string, scope: UniquenessScope): Promise<UniquenessResult> {
    const topK = scope.topK ?? 10;
    const now = Date.now();
    const windowMs = (scope.windowDays ?? 30) * 24 * 60 * 60 * 1000;
    const minTs = now - windowMs;

    const embedding = cheapDeterministicEmbedding(text, this.dim);
    const shingles = new Set(shingle(text));

    const scopeKey = makeScopeKey(scope);
    const candidates = this.items.filter(i => i.scopeKey === scopeKey && i.createdAt >= minTs);

    const scored: Neighbor[] = candidates.map(i => {
      const cos = cosineSimilarity(embedding, i.embedding);
      const jac = jaccard(shingles, i.shingles);
      return { messageId: i.messageId, cosine: cos, jaccard: jac };
    }).sort((a, b) => b.cosine - a.cosine).slice(0, topK);

    const maxCosine = scored.length ? scored[0].cosine : 0;
    const maxJaccard = scored.length ? Math.max(...scored.map(n => n.jaccard ?? 0)) : 0;
    const score = Math.max(0, Math.min(1, 1 - maxCosine));

    return { score, maxCosine, maxJaccard, neighbors: scored };
  }

  async upsert(messageId: string, text: string, scope: UniquenessScope): Promise<void> {
    const scopeKey = makeScopeKey(scope);
    const idx = this.items.findIndex(i => i.messageId === messageId && i.scopeKey === scopeKey);
    const item: MemoryItem = {
      messageId,
      scopeKey,
      embedding: cheapDeterministicEmbedding(text, this.dim),
      shingles: new Set(shingle(text)),
      createdAt: Date.now(),
    };
    if (idx >= 0) this.items[idx] = item; else this.items.push(item);
  }
}


