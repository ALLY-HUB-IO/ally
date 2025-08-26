import Redis from "ioredis";
import { ingestStreamKey, scoredStreamKey, dlqStreamKey, xaddObj, xreadGroupOnce } from "../src/streams";

// Integration portion is opt-in to avoid requiring Redis locally.
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const RUN_INTEGRATION = process.env.REDIS_INTEGRATION === "1";

describe("streams helpers", () => {
  test("key builders format correctly", () => {
    expect(ingestStreamKey("p1", "discord")).toBe("ally:events:ingest:v1:p1:discord");
    expect(scoredStreamKey("p1")).toBe("ally:events:scored:v1:p1");
    expect(dlqStreamKey("p1")).toBe("ally:events:dlq:v1:p1");
  });

  (RUN_INTEGRATION ? test : test.skip)("xaddObj writes and xreadGroupOnce reads", async () => {
    const projectId = `test-${Date.now()}`;
    const stream = ingestStreamKey(projectId, "discord");
    const redis = new Redis(REDIS_URL, { connectTimeout: 500 });
    const group = `cg:${projectId}`;
    const consumer = `c-${Math.random().toString(36).slice(2)}`;

    try {
      // create consumer group at $ (new messages only)
      await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM");
    } catch (e: any) {
      if (!String(e?.message).includes("BUSYGROUP")) throw e;
    }

    // Add two messages with MAXLEN trimming
    await xaddObj(redis as any, stream, { a: "1" }, { maxLen: { strategy: "approx", count: 1000 } });
    await xaddObj(redis as any, stream, { a: "2" }, { maxLen: { strategy: "approx", count: 1000 } });

    let handled = 0;
    const num = await xreadGroupOnce(redis as any, {
      group,
      consumer,
      streams: [stream],
      count: 10,
      blockMs: 200,
      handler: async () => { handled += 1; },
    });
    expect(num).toBeGreaterThanOrEqual(1);
    expect(handled).toBe(num);

    await redis.quit();
  }, 10_000);
});


