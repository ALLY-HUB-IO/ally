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

export type DiscordMessageCreated = z.infer<typeof DiscordMessageCreated>;
export type DiscordMessageUpdated = z.infer<typeof DiscordMessageUpdated>;


