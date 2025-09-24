import { Client, GatewayIntentBits, Partials, Message, Events, MessageReaction, User } from "discord.js";
import { EventEnvelope } from "@ally/events/envelope";
import { EventType, EVENT_VERSION } from "@ally/events/catalog";
import { normalizeMessageCreated, normalizeMessageUpdated, normalizeReactionAdded, normalizeReactionRemoved, normalizeMessageDeleted } from "./normalizers.js";

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
      // Ensure we have the full message data, including references
      const fullMessage = message.partial ? await message.fetch() : message;
      const payload = normalizeMessageCreated(fullMessage);
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

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (!options.includeBots && user.bot) return;
    try {
      const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
      const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
      const payload = normalizeReactionAdded(fullReaction, message);
      const envelope: EventEnvelope<typeof payload> = {
        version: EVENT_VERSION,
        idempotencyKey: `discord:reaction:added:${payload.externalId}:${payload.createdAt}`,
        projectId: options.projectId,
        platform: "discord",
        type: EventType.DISCORD_REACTION_ADDED,
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
      console.error("Failed to normalize or publish MessageReactionAdd", err);
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (!options.includeBots && user.bot) return;
    try {
      const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
      const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
      const payload = normalizeReactionRemoved(fullReaction, message, user as User);
      const envelope: EventEnvelope<typeof payload> = {
        version: EVENT_VERSION,
        idempotencyKey: `discord:reaction:removed:${payload.externalId}:${payload.createdAt}`,
        projectId: options.projectId,
        platform: "discord",
        type: EventType.DISCORD_REACTION_REMOVED,
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
      console.error("Failed to normalize or publish MessageReactionRemove", err);
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    try {
      // For deleted messages, we might have partial data
      const guildId = message.guild?.id;
      const channelId = message.channelId;
      
      // Handle both full and partial messages
      const messageData = message.partial ? null : message;
      const payload = normalizeMessageDeleted(messageData, channelId, guildId);
      const envelope: EventEnvelope<typeof payload> = {
        version: EVENT_VERSION,
        idempotencyKey: `discord:deleted:${payload.externalId}:${payload.deletedAt}`,
        projectId: options.projectId,
        platform: "discord",
        type: EventType.DISCORD_MESSAGE_DELETED,
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
      console.error("Failed to normalize or publish MessageDelete", err);
    }
  });

  // Handle thread creation events
  client.on(Events.ThreadCreate, async (thread) => {
    try {
      // Try to fetch the starter message
      const starterMessage = await thread.fetchStarterMessage();
      
      if (starterMessage) {
        console.log(`[discord-adapter] Thread created: ${thread.name} from message ${starterMessage.id}`);
        
        // Publish a thread creation event with the starter message info
        const payload = {
          threadId: thread.id,
          threadName: thread.name,
          guildId: thread.guildId,
          parentChannelId: thread.parentId,
          starterMessageId: starterMessage.id,
          starterMessageContent: starterMessage.content,
          starterMessageAuthor: {
            id: starterMessage.author.id,
            username: starterMessage.author.username,
            displayName: (starterMessage.author as any).globalName ?? (starterMessage.author as any).displayName,
            avatarUrl: starterMessage.author.displayAvatarURL()
          },
          createdAt: thread.createdAt?.toISOString() || new Date().toISOString()
        };
        
        const envelope: EventEnvelope<typeof payload> = {
          version: EVENT_VERSION,
          idempotencyKey: `discord:thread:created:${thread.id}:${payload.createdAt}`,
          projectId: options.projectId,
          platform: "discord",
          type: EventType.DISCORD_THREAD_CREATED,
          ts: new Date().toISOString(),
          source: {
            guildId: thread.guildId ?? undefined,
            channelId: thread.parentId ?? undefined,
            threadId: thread.id
          },
          payload
        };
        
        await publisher.publish(envelope);
      } else {
        console.log(`[discord-adapter] Thread created but could not fetch starter message: ${thread.name}`);
      }
    } catch (error) {
      console.error('[discord-adapter] Error handling thread creation:', error);
    }
  });

  // Handle thread deletion events
  client.on(Events.ThreadDelete, async (thread) => {
    try {
      console.log(`[discord-adapter] Thread deleted: ${thread.name} (${thread.id})`);
      
      // Publish a thread deletion event
      const payload = {
        threadId: thread.id,
        threadName: thread.name,
        guildId: thread.guildId,
        parentChannelId: thread.parentId,
        deletedAt: new Date().toISOString()
      };
      
      const envelope: EventEnvelope<typeof payload> = {
        version: EVENT_VERSION,
        idempotencyKey: `discord:thread:deleted:${thread.id}:${payload.deletedAt}`,
        projectId: options.projectId,
        platform: "discord",
        type: EventType.DISCORD_THREAD_DELETED,
        ts: new Date().toISOString(),
        source: {
          guildId: thread.guildId ?? undefined,
          channelId: thread.parentId ?? undefined,
          threadId: thread.id
        },
        payload
      };
      
      await publisher.publish(envelope);
    } catch (error) {
      console.error('[discord-adapter] Error handling thread deletion:', error);
    }
  });

  client.login(token).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Discord login failed", err);
    throw err;
  });

  return client;
}


