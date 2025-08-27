import { Attachment, Guild, Message, MessageType, ThreadChannel, User, MessageReaction, Emoji } from "discord.js";
import type { DiscordMessageCreated, DiscordMessageUpdated, DiscordReactionEvent } from "@ally/events/schemas";

function buildAuthor(user: User | null | undefined) {
  return {
    id: user?.id ?? "unknown",
    username: user?.username,
    discriminator: (user as any)?.discriminator, // discord.js v14 removed discriminator for usernames; keep optional
    displayName: (user as any)?.globalName ?? (user as any)?.displayName,
    isBot: user?.bot ?? false,
    roles: undefined,
  };
}

function buildAttachments(attachments: Map<string, Attachment> | Attachment[]) {
  const list = Array.isArray(attachments) ? attachments : Array.from(attachments.values());
  return list.map((a) => ({ id: a.id, url: a.url, contentType: a.contentType ?? undefined }));
}

function messageLink(message: Message) {
  const guildId = message.guildId ?? "@me";
  return `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`;
}

function threadIdOf(message: Message): string | null | undefined {
  const channel = message.channel;
  if ((channel as ThreadChannel)?.isThread?.()) return (channel as ThreadChannel).id;
  return (message as any).thread?.id ?? null;
}

export function normalizeMessageCreated(message: Message): DiscordMessageCreated {
  const guild: Guild | null = message.guild ?? null;
  return {
    externalId: message.id,
    guildId: guild?.id ?? undefined,
    channelId: message.channelId,
    threadId: threadIdOf(message),
    author: buildAuthor(message.author),
    content: message.content ?? "",
    attachments: buildAttachments(message.attachments as any),
    link: messageLink(message),
    createdAt: message.createdAt.toISOString(),
  };
}

export function normalizeMessageUpdated(message: Message): DiscordMessageUpdated {
  const guild: Guild | null = message.guild ?? null;
  return {
    externalId: message.id,
    guildId: guild?.id ?? undefined,
    channelId: message.channelId,
    threadId: threadIdOf(message),
    author: buildAuthor(message.author),
    content: message.content ?? "",
    attachments: buildAttachments(message.attachments as any),
    link: messageLink(message),
    editedAt: (message.editedAt ?? message.createdAt).toISOString(),
    previousContent: (message as any).previousContent,
  };
}

function buildEmoji(emoji: Emoji) {
  return {
    id: emoji.id,
    name: emoji.name ?? "unknown",
    animated: emoji.animated ?? false,
  };
}

export function normalizeReactionAdded(reaction: MessageReaction, message: Message): DiscordReactionEvent {
  const guild: Guild | null = message.guild ?? null;
  return {
    externalId: `${reaction.emoji.id ?? reaction.emoji.name}-${reaction.users.cache.first()?.id ?? 'unknown'}`,
    messageId: message.id,
    guildId: guild?.id ?? undefined,
    channelId: message.channelId,
    threadId: threadIdOf(message),
    author: buildAuthor(reaction.users.cache.first()),
    emoji: buildEmoji(reaction.emoji),
    messageAuthor: buildAuthor(message.author),
    messageContent: message.content ?? "",
    reactionCount: reaction.count ?? 0,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeReactionRemoved(reaction: MessageReaction, message: Message): DiscordReactionEvent {
  const guild: Guild | null = message.guild ?? null;
  return {
    externalId: `${reaction.emoji.id ?? reaction.emoji.name}-${reaction.users.cache.first()?.id ?? 'unknown'}`,
    messageId: message.id,
    guildId: guild?.id ?? undefined,
    channelId: message.channelId,
    threadId: threadIdOf(message),
    author: buildAuthor(reaction.users.cache.first()),
    emoji: buildEmoji(reaction.emoji),
    messageAuthor: buildAuthor(message.author),
    messageContent: message.content ?? "",
    reactionCount: (reaction.count ?? 1) - 1, // Subtract 1 since reaction was removed
    createdAt: new Date().toISOString(),
  };
}


