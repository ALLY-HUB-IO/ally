import { z } from "zod";

export const DiscordAuthor = z.object({
  id: z.string(),
  username: z.string().optional(),
  discriminator: z.string().optional(),
  displayName: z.string().optional(),
  isBot: z.boolean().optional(),
  roles: z.array(z.string()).optional(),
});

export const DiscordAttachment = z.object({
  id: z.string(),
  url: z.string(),
  contentType: z.string().nullable().optional(),
});

export const DiscordMessageBase = z.object({
  externalId: z.string(),
  guildId: z.string().nullable().optional(),
  channelId: z.string(),
  threadId: z.string().nullable().optional(),
  author: DiscordAuthor,
  content: z.string(),
  attachments: z.array(DiscordAttachment).optional(),
  link: z.string().optional(),
});

export const DiscordMessageCreated = DiscordMessageBase.extend({
  createdAt: z.string(),
});

export const DiscordMessageUpdated = DiscordMessageBase.extend({
  editedAt: z.string(),
  previousContent: z.string().optional(),
});

export const DiscordEmoji = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  animated: z.boolean().optional(),
});

export const DiscordReactionEvent = z.object({
  externalId: z.string(),
  messageId: z.string(),
  guildId: z.string().nullable().optional(),
  channelId: z.string(),
  threadId: z.string().nullable().optional(),
  author: DiscordAuthor,
  emoji: DiscordEmoji,
  messageAuthor: DiscordAuthor,
  messageContent: z.string(),
  reactionCount: z.number(),
  createdAt: z.string(),
});

export type DiscordMessageCreated = z.infer<typeof DiscordMessageCreated>;
export type DiscordMessageUpdated = z.infer<typeof DiscordMessageUpdated>;
export type DiscordReactionEvent = z.infer<typeof DiscordReactionEvent>;


