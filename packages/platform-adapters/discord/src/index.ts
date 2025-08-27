import { Client, GatewayIntentBits, Partials, Message, Events } from "discord.js";
import { EventEnvelope } from "@ally/events/envelope";
import { EventType, EVENT_VERSION } from "@ally/events/catalog";
import { normalizeMessageCreated, normalizeMessageUpdated } from "./normalizers.js";

export type Publisher = {
  publish: <T>(event: EventEnvelope<T>) => Promise<void>;
};

export type DiscordAdapterOptions = {
  projectId: string;
  token?: string; // optional override; falls back to env
  includeBots?: boolean; // default false
  allowedGuilds?: string[]; // optional guild allowlist
  allowedChannels?: string[]; // optional channel allowlist
  minMessageLength?: number; // minimum message length to process
};

export function startDiscordAdapter(options: DiscordAdapterOptions, publisher: Publisher) {
  const token = options.token ?? process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is required to start Discord adapter");
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (!options.includeBots && message.author?.bot) return;
    try {
      const payload = normalizeMessageCreated(message);
      const envelope: EventEnvelope<typeof payload> = {
        version: EVENT_VERSION,
        idempotencyKey: `discord:created:${payload.externalId}:${payload.createdAt}`,
        projectId: options.projectId,
        platform: "discord",
        type: EventType.DISCORD_MESSAGE_CREATED,
        ts: new Date().toISOString(),
        source: {
          guildId: payload.guildId ?? undefined,
          channelId: payload.channelId,
          threadId: payload.threadId ?? null
        },
        payload
      };
      await publisher.publish(envelope);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to normalize or publish MessageCreate", err);
    }
  });

  client.on(Events.MessageUpdate, async (_old, newMessage) => {
    const message = newMessage.partial ? await newMessage.fetch() : newMessage;
    if (!options.includeBots && message.author?.bot) return;
    try {
      const payload = normalizeMessageUpdated(message);
      const envelope: EventEnvelope<typeof payload> = {
        version: EVENT_VERSION,
        idempotencyKey: `discord:updated:${payload.externalId}:${payload.editedAt}`,
        projectId: options.projectId,
        platform: "discord",
        type: EventType.DISCORD_MESSAGE_UPDATED,
        ts: new Date().toISOString(),
        source: {
          guildId: payload.guildId ?? undefined,
          channelId: payload.channelId,
          threadId: payload.threadId ?? null
        },
        payload
      };
      await publisher.publish(envelope);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to normalize or publish MessageUpdate", err);
    }
  });

  client.login(token).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Discord login failed", err);
    throw err;
  });

  return client;
}


