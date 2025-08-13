export type HttpOptions = {
    baseUrl: string;
    apiKey?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  };
  
  export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
  export type LLMSettings = {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  }
  
  export type RagChatRequest = {
    projectId: string;        // which KB on EdgeCloud
    messages: ChatMessage[];  // chat history, unlimited length
    // Legacy fallback (optional). If provided and messages is empty, will be used as a single user message
    prompt?: string;
    // optionally: temperature, max_tokens
    settings?: LLMSettings;
  };
  
  export type Source = { url: string; snippet?: string };
  export type RagChatResponse = {
    content: string;
    model?: string;
    sources?: Source[];
    usage?: { tokens?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  
  export interface RagService {
    chat(req: RagChatRequest): Promise<RagChatResponse>;
  }
  
  export interface Provider {
    name: string;
    rag?: RagService;
    // later: embed?: EmbedService; moderate?: ModerationService; custom?: Record<string, Function>
  }