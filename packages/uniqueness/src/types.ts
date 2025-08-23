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
  score: number; // 0..1 (1 = unique)
  maxCosine: number;
  maxJaccard?: number;
  neighbors: Neighbor[];
}

export interface UniquenessScorer {
  score(text: string, scope: UniquenessScope): Promise<UniquenessResult>;
  upsert(messageId: string, text: string, scope: UniquenessScope): Promise<void>;
}


