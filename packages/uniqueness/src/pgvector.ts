import { getPrismaClient } from "@ally/db";
import type { Neighbor, UniquenessResult, UniquenessScope, UniquenessScorer } from "./types.js";

// NOTE: Prisma does not yet have first-class vector type here; we'll use raw SQL.

function toVectorLiteral(vec: number[] | Float32Array): string {
  // pgvector expects [x,y,z]
  return `'[${Array.from(vec).join(",")}]'`;
}

async function ensurePgvector(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
}

export interface PgVectorOptions {
  dim: number;
  table?: string; // default: message_embeddings
}

export class PgVectorUniquenessScorer implements UniquenessScorer {
  private readonly dim: number;
  private readonly table: string;

  constructor(opts: PgVectorOptions) {
    this.dim = opts.dim;
    this.table = opts.table ?? "message_embeddings";
  }

  async init(): Promise<void> {
    await ensurePgvector();
    const prisma = getPrismaClient();
    const table = this.table;
    // Create table if not exists
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        channel_id TEXT,
        author_id TEXT,
        embedding vector(${this.dim}) NOT NULL,
        minhash BYTEA,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    );
    // Basic index; refine to IVFFLAT/HNSW in migrations later
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS ${table}_project_platform_created_idx ON ${table}(project_id, platform, created_at DESC)`
    );
  }

  private scopeWhere(scope: UniquenessScope, minTsIso: string): string {
    const conds: string[] = [
      `project_id = '${scope.projectId.replace(/'/g, "''")}'`,
      `platform = '${scope.platform.replace(/'/g, "''")}'`,
      `created_at >= '${minTsIso}'`
    ];
    if (scope.channelId) conds.push(`channel_id = '${scope.channelId.replace(/'/g, "''")}'`);
    // AuthorId optional; we generally do not filter by author for similarity search
    return conds.join(" AND ");
  }

  // Placeholder: cheap deterministic embedding; replace with real encoder in higher layer.
  private embed(text: string): Float32Array {
    const dim = this.dim;
    const out = new Float32Array(dim);
    let seed = 2166136261;
    const s = text.replace(/\s+/g, " ").trim().toLowerCase();
    for (let i = 0; i < s.length; i++) {
      seed ^= s.charCodeAt(i);
      seed += (seed << 1) + (seed << 4) + (seed << 7) + (seed << 8) + (seed << 24);
      const idx = seed >>> 0 % dim;
      out[idx] += 1;
    }
    return out;
  }

  private jaccardApprox(_textA: string, _textB: string): number {
    // For now, skip MinHash comparison in DB path; can store shingles/minhash later.
    return 0;
  }

  async score(text: string, scope: UniquenessScope): Promise<UniquenessResult> {
    const prisma = getPrismaClient();
    const topK = scope.topK ?? 10;
    const now = Date.now();
    const windowMs = (scope.windowDays ?? 30) * 24 * 60 * 60 * 1000;
    const minTsIso = new Date(now - windowMs).toISOString();

    const emb = this.embed(text);
    const vec = toVectorLiteral(emb);
    const table = this.table;
    const where = this.scopeWhere(scope, minTsIso);
    // cosine distance in pgvector: <-> for Euclidean, but for cosine distance you use <%> operator in newer versions; fallback to 1 - cosine
    const sql = `SELECT id as message_id, 1 - (embedding <#> ${vec}) as cosine
                 FROM ${table}
                 WHERE ${where}
                 ORDER BY embedding <#> ${vec} ASC
                 LIMIT ${topK}`;
    // Note: <#> is L2 distance; we approximate cosine via normalized embeddings in a real impl.
    const rows = await prisma.$queryRawUnsafe<Array<{ message_id: string; cosine: number }>>(sql);
    const neighbors: Neighbor[] = rows.map((r: any) => ({ messageId: r.message_id, cosine: r.cosine }));
    const maxCosine = neighbors.length ? neighbors[0].cosine : 0;
    return { score: Math.max(0, Math.min(1, 1 - maxCosine)), maxCosine, neighbors };
  }

  async upsert(messageId: string, text: string, scope: UniquenessScope): Promise<void> {
    const prisma = getPrismaClient();
    const table = this.table;
    const emb = this.embed(text);
    const vec = toVectorLiteral(emb);
    const sql = `INSERT INTO ${table} (id, project_id, platform, channel_id, author_id, embedding)
                 VALUES ('${messageId.replace(/'/g, "''")}', '${scope.projectId.replace(/'/g, "''")}', '${scope.platform.replace(/'/g, "''")}', ${scope.channelId ? `'${scope.channelId.replace(/'/g, "''")}'` : 'NULL'}, ${scope.authorId ? `'${scope.authorId.replace(/'/g, "''")}'` : 'NULL'}, ${vec})
                 ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding, project_id = EXCLUDED.project_id, platform = EXCLUDED.platform, channel_id = EXCLUDED.channel_id, author_id = EXCLUDED.author_id`;
    await prisma.$executeRawUnsafe(sql);
  }
}


