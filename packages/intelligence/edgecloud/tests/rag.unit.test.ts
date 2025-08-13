import { getEdgeCloud } from "../src/integrator";

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch as any; });

test("ragChat sends correct payload and normalizes response", async () => {
  // Mock fetch
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "Theta response" } }],
      sources: [{ url: "https://docs.theta", snippet: "..." }],
      usage: { tokens: 123 }
    })
  } as any);

  process.env.TEC_RAG_BASE_URL = "https://edgecloud.example.com";
  process.env.TEC_RAG_API_KEY  = "test-key";

  const ec = getEdgeCloud();
  const out = await ec.ragChat({
    projectId: "proj-1",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "What is TFuel?" }
    ]
  });

  expect(global.fetch).toHaveBeenCalledWith(
    "https://edgecloud.example.com/chatbot/proj-1/chat/completions",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "content-type": "application/json",
        authorization: "Bearer test-key"
      })
    })
  );
  expect(out.content).toBe("Theta response");
  expect(out.sources?.[0].url).toBe("https://docs.theta");
});

test("ragChat throws on non-OK response", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => "server error"
  } as any);

  const ec = getEdgeCloud();
  await expect(ec.ragChat({
    projectId: "p",
    messages: [
      { role: "user", content: "x" }
    ]
  }))
    .rejects.toThrow(/ThetaEdgeCloud 500/i);
});