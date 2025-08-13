import { HttpOptions, Provider, RagChatRequest, RagChatResponse, RagService } from "../models";

function coerceText(value: any): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.map((v) => coerceText(v)).filter((t): t is string => !!t);
    const joined = parts.join(" ").trim();
    return joined || undefined;
  }
  if (typeof value === "object") {
    return (
      coerceText(value.text) ??
      coerceText(value.content) ??
      coerceText(value.message) ??
      coerceText(value.output) ??
      coerceText(value.output_text)
    );
  }
  return undefined;
}

function findFirstStringDeep(value: any): string | undefined {
  const preferredKeys = new Set(["content", "text", "message", "output", "output_text"]);
  const visited = new Set<any>();

  function dfs(node: any): string | undefined {
    if (node == null) return undefined;
    if (typeof node === "string") return node.trim() || undefined;
    if (visited.has(node)) return undefined;
    if (typeof node !== "object") return undefined;
    visited.add(node);

    // Prefer known keys first
    for (const key of preferredKeys) {
      if (key in node) {
        const hit = dfs(node[key]);
        if (hit) return hit;
      }
    }
    // Then scan arrays/objects
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = dfs(item);
        if (hit) return hit;
      }
    } else {
      for (const k of Object.keys(node)) {
        const hit = dfs(node[k]);
        if (hit) return hit;
      }
    }
    return undefined;
  }

  return dfs(value);
}

async function postJson<T>(url: string, body: unknown, opts: HttpOptions): Promise<T> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
        ...opts.headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`ThetaEdgeCloud ${res.status} ${await res.text().catch(()=>"")}`);
    return await res.json() as T;
  } finally {
    clearTimeout(to);
  }
}

export function thetaProvider(opts: HttpOptions): Provider {
  const rag: RagService = {
    async chat(req: RagChatRequest): Promise<RagChatResponse> {
      // Theta EdgeCloud chatbot completions endpoint
      const base = opts.baseUrl.replace(/\/$/, "");
      const url = `${base}/chatbot/${req.projectId}/chat/completions`;
      const messages = (req.messages && req.messages.length > 0)
        ? req.messages
        : [{ role: "user", content: req.prompt ?? "" }];

      const payload = {
        messages,
        // Reasonable defaults; can be parameterized later via RagChatRequest
        max_tokens: req.settings?.max_tokens ?? 1024,
        temperature: req.settings?.temperature ?? 0.3,
        stream: false
      };
      const raw = await postJson<any>(url, payload, opts);
      const data = raw?.body ?? raw; // API may wrap payload under `body`

      let content =
        coerceText(data?.answer) ??
        coerceText(data?.text) ??
        coerceText(data?.choices?.[0]?.message?.content) ??
        coerceText(data?.choices?.[0]?.message) ??
        coerceText(data?.choices?.[0]) ??
        coerceText(data?.content) ??
        coerceText(data?.data) ??
        coerceText(data?.message) ??
        coerceText(data?.output) ??
        coerceText(data?.output_text) ??
        "";

      if (!content) {
        content = findFirstStringDeep(data) ?? "";
      }

      return {
        content,
        model: data?.model,
        sources: data?.sources?.map((s: any) => ({ url: s.url, snippet: s.snippet })) ?? [],
        usage: data?.usage ?? raw?.usage ?? {
          tokens: data?.usage?.total_tokens ?? raw?.usage?.total_tokens,
          prompt_tokens: data?.usage?.prompt_tokens ?? raw?.usage?.prompt_tokens,
          completion_tokens: data?.usage?.completion_tokens ?? raw?.usage?.completion_tokens,
          total_tokens: data?.usage?.total_tokens ?? raw?.usage?.total_tokens
        }
      };
    }
  };
  return { name: "theta", rag };
}