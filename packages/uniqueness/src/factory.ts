import type { UniquenessScorer } from "./types.js";
import { MemoryUniquenessScorer } from "./memory.js";
export type { PgVectorOptions } from "./pgvector.js";

export type Backend = "memory" | "pgvector";

export interface CreateUniquenessOptions {
  backend?: Backend;
  dim?: number;
  pgvector?: { table?: string; dim?: number };
}

export async function createUniquenessScorer(opts?: CreateUniquenessOptions): Promise<UniquenessScorer> {
  const backend = opts?.backend ?? (process.env.UNIQUENESS_BACKEND as Backend) ?? "memory";
  const dim = opts?.dim ?? Number(process.env.UNIQUENESS_DIM ?? 128);

  if (backend === "pgvector") {
    try {
      const mod = await import("./pgvector.js");
      const scorer = new mod.PgVectorUniquenessScorer({ dim, table: opts?.pgvector?.table });
      await scorer.init();
      return scorer;
    } catch (err) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("PgVectorUniquenessScorer init failed; falling back to memory:", (err as Error).message);
      }
      return new MemoryUniquenessScorer(dim);
    }
  }

  return new MemoryUniquenessScorer(dim);
}


