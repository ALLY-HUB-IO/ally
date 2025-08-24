export type EventEnvelope<TPayload> = {
  version: string;            // e.g. "v1"
  idempotencyKey: string;     // unique per logical event
  projectId: string;          // multi-tenant project id
  platform: "discord";       // extend later for other platforms
  type: string;               // event name from catalog
  ts: string;                 // ISO timestamp when produced
  source: {
    guildId?: string;
    channelId?: string;
    threadId?: string | null;
  };
  payload: TPayload;          // validated normalized payload
};


