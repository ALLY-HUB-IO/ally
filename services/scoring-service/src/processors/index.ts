// Export all platform processors
export { DiscordEventProcessor } from './discordProcessor.js';
export { TelegramEventProcessor } from './telegramProcessor.js';

// Re-export types for convenience
export type { PlatformEventProcessor } from '../types.js';
export { MessageContext } from '../types.js';
