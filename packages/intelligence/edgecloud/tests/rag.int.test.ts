// packages/intelligence/edgecloud/tests/rag.int.test.ts
import path from "path";
import dotenv from "dotenv";

// Load the infra/.env file
dotenv.config({ path: path.resolve(__dirname, "../../../../infra/.env") });

import { getEdgeCloud } from "../src/integrator";

const required = ["TEC_RAG_BASE_URL", "TEC_RAG_API_KEY", "TEC_CHAT_ID"];
const hasEnv = required.every((k) => !!process.env[k]);

(hasEnv ? describe : describe.skip)("EdgeCloud (integration)", () => {
  test("ragChat returns an answer", async () => {
    const ec = getEdgeCloud();
    const res = await ec.ragChat({
      projectId: process.env.TEC_CHAT_ID!,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Summarize Theta EdgeCloud in one sentence." }
      ]
    });
    expect(res.content).toBeTruthy();
  }, 20_000);
});