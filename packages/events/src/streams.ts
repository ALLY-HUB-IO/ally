export type RedisLike = {
  xadd: (...args: any[]) => Promise<string>;
  xreadgroup: (...args: any[]) => Promise<any>;
  xack: (...args: any[]) => Promise<number>;
  xgroup?: (...args: any[]) => Promise<any>;
};

// Stream key builders
export function ingestStreamKey(projectId: string, platform: string): string {
  return `ally:events:ingest:v1:${projectId}:${platform}`;
}

export function scoredStreamKey(projectId: string): string {
  return `ally:events:scored:v1:${projectId}`;
}

export function dlqStreamKey(projectId: string): string {
  return `ally:events:dlq:v1:${projectId}`;
}

// Flatten object into field-value pairs
export function objectToPairs(obj: Record<string, string>): string[] {
  return Object.entries(obj).flatMap(([k, v]) => [k, v]);
}

export type XAddOptions = {
  maxLen?: { strategy?: "approx" | "exact"; count: number };
  id?: string | "*"; // default: "*"
};

// xadd with optional MAXLEN trimming and object payload
export async function xaddObj(
  client: RedisLike,
  stream: string,
  fields: Record<string, string>,
  options?: XAddOptions
): Promise<string> {
  const args: any[] = [stream];
  if (options?.maxLen) {
    args.push("MAXLEN");
    args.push(options.maxLen.strategy === "exact" ? "=" : "~");
    args.push(String(options.maxLen.count));
  }
  args.push(options?.id ?? "*");
  args.push(...objectToPairs(fields));
  return client.xadd(...args);
}

export type XReadGroupLoopOptions = {
  group: string;
  consumer: string;
  streams: string[];
  count?: number; // default 50
  blockMs?: number; // default 5000
  autoAck?: boolean; // default true
  abortSignal?: AbortSignal;
  handler: (params: {
    stream: string;
    id: string;
    fields: Record<string, string>;
  }) => Promise<void>;
};

// Helper: convert pairs array [k1,v1,k2,v2,...] to object
export function pairsToObject(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < pairs.length; i += 2) {
    out[pairs[i]] = pairs[i + 1];
  }
  return out;
}

// One-shot read to facilitate tests and controlled polling
export async function xreadGroupOnce(
  client: RedisLike,
  opts: XReadGroupLoopOptions
): Promise<number> {
  const count = opts.count ?? 50;
  const block = opts.blockMs ?? 5000;
  const placeholders = Array(opts.streams.length).fill(">");
  const res = await client.xreadgroup(
    "GROUP",
    opts.group,
    opts.consumer,
    "BLOCK",
    block,
    "COUNT",
    count,
    "STREAMS",
    ...opts.streams,
    ...placeholders
  );
  if (!res) return 0;
  let handled = 0;
  for (const [streamKey, entries] of res as [string, any[]][]) {
    for (const [id, pairs] of entries as [string, string[]][]) {
      await opts.handler({ stream: streamKey, id, fields: pairsToObject(pairs) });
      handled += 1;
      if (opts.autoAck !== false) {
        await client.xack(streamKey, opts.group, id);
      }
    }
  }
  return handled;
}

// Continuous polling loop with abort support
export async function xreadGroupLoop(client: RedisLike, opts: XReadGroupLoopOptions): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (opts.abortSignal?.aborted) break;
    try {
      await xreadGroupOnce(client, opts);
    } catch (err) {
      // Swallow transient errors; production code could emit logs/metrics
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}


