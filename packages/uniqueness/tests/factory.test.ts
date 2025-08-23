import { createUniquenessScorer } from "../src/factory.js";

describe("createUniquenessScorer", () => {
  it("creates memory backend by default", async () => {
    const scorer = await createUniquenessScorer();
    const res = await scorer.score("hello", { projectId: "p", platform: "other" });
    expect(typeof res.score).toBe("number");
  });

  it("falls back to memory if pgvector init fails", async () => {
    const scorer = await createUniquenessScorer({ backend: "pgvector", dim: 32 });
    const res = await scorer.score("hello", { projectId: "p", platform: "other" });
    expect(typeof res.score).toBe("number");
  });
});


