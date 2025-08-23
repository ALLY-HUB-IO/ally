export type Platform = "discord" | "telegram" | "x" | "other";
export interface UniquenessScope {
  projectId: string;
  platform: Platform;
  channelId?: string;
  authorId?: string;
  windowDays?: number;
  topK?: number;
}
export interface Neighbor {
  messageId: string;
  cosine: number;
  jaccard?: number;
}
export interface UniquenessResult {
  score: number;
  maxCosine: number;
  maxJaccard?: number;
  neighbors: Neighbor[];
}
export interface UniquenessScorer {
  score(text: string, scope: UniquenessScope): Promise<UniquenessResult>;
  upsert(messageId: string, text: string, scope: UniquenessScope): Promise<void>;
}
export declare class MemoryUniquenessScorer implements UniquenessScorer {
  constructor(dim?: number);
  score(text: string, scope: UniquenessScope): Promise<UniquenessResult>;
  upsert(messageId: string, text: string, scope: UniquenessScope): Promise<void>;
}
export interface PgVectorOptions {
  dim: number;
  table?: string;
}
export declare class PgVectorUniquenessScorer implements UniquenessScorer {
  constructor(opts: PgVectorOptions);
  init(): Promise<void>;
  score(text: string, scope: UniquenessScope): Promise<UniquenessResult>;
  upsert(messageId: string, text: string, scope: UniquenessScope): Promise<void>;
}
export type Backend = "memory" | "pgvector";
export interface CreateUniquenessOptions {
  backend?: Backend;
  dim?: number;
  pgvector?: Omit<PgVectorOptions, "dim"> & { dim?: number };
}
export declare function createUniquenessScorer(opts?: CreateUniquenessOptions): Promise<UniquenessScorer>;


