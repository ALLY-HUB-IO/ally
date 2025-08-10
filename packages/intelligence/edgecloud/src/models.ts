export type HttpOptions = {
    baseUrl: string;
    apiKey?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  };
  
  export type RagChatRequest = {
    projectId: string;        // which KB on EdgeCloud
    prompt: string;
    // optionally: userId, history, temperature, etc.
  };
  
  export type Source = { url: string; snippet?: string };
  export type RagChatResponse = {
    text: string;
    sources?: Source[];
    usage?: { tokens?: number };
  };
  
  export interface RagService {
    chat(req: RagChatRequest): Promise<RagChatResponse>;
  }
  
  export interface Provider {
    name: string;
    rag?: RagService;
    // later: embed?: EmbedService; moderate?: ModerationService; custom?: Record<string, Function>
  }