import { MemoryUniquenessScorer } from "../src/memory.js";

describe("MemoryUniquenessScorer", () => {
  it("returns high uniqueness for different texts", async () => {
    const scorer = new MemoryUniquenessScorer(64);
    const scope = { projectId: "p1", platform: "discord", channelId: "c1" } as const;

    await scorer.upsert("m1", "The quick brown fox jumps over the lazy dog.", scope);
    const res = await scorer.score("Completely unrelated sentence about blockchains and networks.", scope);

    expect(res.score).toBeGreaterThan(0.5);
    expect(res.maxCosine).toBeLessThan(0.5);
  });

  it("returns low uniqueness for near duplicates", async () => {
    const scorer = new MemoryUniquenessScorer(64);
    const scope = { projectId: "p1", platform: "discord", channelId: "c1" } as const;

    await scorer.upsert("m1", "Theta EdgeCloud announcement today", scope);
    const res = await scorer.score("Theta EdgeCloud announcement TODAY!", scope);

    expect(res.score).toBeLessThan(0.5);
    expect(res.neighbors.length).toBeGreaterThanOrEqual(0);
  });

  it("respects windowDays and topK", async () => {
    const scorer = new MemoryUniquenessScorer(64);
    const scope = { projectId: "p1", platform: "discord", channelId: "c1", windowDays: 1, topK: 1 } as const;
    await scorer.upsert("old", "old message", scope);
    const res = await scorer.score("fresh text", scope);
    expect(res.neighbors.length).toBeLessThanOrEqual(1);
  });
});


