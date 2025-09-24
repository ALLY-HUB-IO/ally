import { Attachment, Guild, Message, MessageType, ThreadChannel, User, MessageReaction, Emoji } from "discord.js";
import type { DiscordMessageCreated, DiscordMessageUpdated, DiscordReactionEvent, DiscordMessageDeleted } from "@ally/events/schemas";

function buildAuthor(user: User | null | undefined) {
  return {
    id: user?.id ?? "unknown",
    username: user?.username,
    discriminator: (user as any)?.discriminator, // discord.js v14 removed discriminator for usernames; keep optional
    displayName: (user as any)?.globalName ?? (user as any)?.displayName,
    avatarUrl: user?.displayAvatarURL() ?? undefined,
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
  
  // Log reply detection for monitoring
  if (message.type === 19) {
    console.log(`[discord-normalizer] Reply detected: ${message.id} -> ${message.reference?.messageId || 'unknown'}`);
  }
  
  // Try to get reference data from different sources
  let referencedMessage = undefined;
  
  // Try multiple possible property names for message references
  const possibleReferences = [
    message.reference,
    (message as any).messageReference,
    (message as any).referencedMessage,
    (message as any).replyTo
  ];
  
  for (const ref of possibleReferences) {
    if (ref?.messageId) {
      referencedMessage = {
        id: ref.messageId,
        channelId: ref.channelId,
        guildId: ref.guildId
      };
      break;
    }
  }
  
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
    referencedMessage,
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

export function normalizeReactionRemoved(reaction: MessageReaction, message: Message, user: User): DiscordReactionEvent {
  const guild: Guild | null = message.guild ?? null;
  return {
    externalId: `${reaction.emoji.id ?? reaction.emoji.name}-${user.id}`,
    messageId: message.id,
    guildId: guild?.id ?? undefined,
    channelId: message.channelId,
    threadId: threadIdOf(message),
    author: buildAuthor(user),
    emoji: buildEmoji(reaction.emoji),
    messageAuthor: buildAuthor(message.author),
    messageContent: message.content ?? "",
    reactionCount: (reaction.count ?? 1) - 1, // Subtract 1 since reaction was removed
    createdAt: new Date().toISOString(),
  };
}

export function normalizeMessageDeleted(message: Message | null, channelId: string, guildId?: string): DiscordMessageDeleted {
  const deletedAt = new Date().toISOString();
  
  // If we have the full message object, extract available data
  if (message) {
    const guild: Guild | null = message.guild ?? null;
    return {
      externalId: message.id,
      guildId: guild?.id ?? guildId ?? undefined,
      channelId: message.channelId,
      threadId: threadIdOf(message),
      author: buildAuthor(message.author),
      content: message.content ?? undefined,
      deletedAt,
      deletedBy: undefined, // Discord doesn't provide this info in delete events
      reason: undefined, // Discord doesn't provide this info in delete events
    };
  }
  
  // If we only have partial message data (common for deletions)
  return {
    externalId: 'unknown', // We don't have the message ID in this case
    guildId,
    channelId,
    threadId: undefined,
    author: undefined,
    content: undefined,
    deletedAt,
    deletedBy: undefined,
    reason: undefined,
  };
}


