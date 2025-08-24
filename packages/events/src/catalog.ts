export const EVENT_VERSION = "v1" as const;

export const EventType = {
  DISCORD_MESSAGE_CREATED: "platform.discord.message.created",
  DISCORD_MESSAGE_UPDATED: "platform.discord.message.updated",
  DISCORD_REACTION_ADDED: "platform.discord.reaction.added",
} as const;

export type EventName = typeof EventType[keyof typeof EventType];


