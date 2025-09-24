// NOT in use yet

import { EventEnvelope } from '@ally/events/envelope';
import { PlatformEventProcessor, MessageContext } from '../types.js';

export class TelegramEventProcessor implements PlatformEventProcessor {
  canHandle(platform: string, eventType: string): boolean {
    return platform === 'telegram' && [
      'TELEGRAM_MESSAGE_CREATED',
      'TELEGRAM_MESSAGE_UPDATED',
      'TELEGRAM_MESSAGE_DELETED',
      'TELEGRAM_REACTION_ADDED',
      'TELEGRAM_REACTION_REMOVED'
    ].includes(eventType);
  }

  async processEvent(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void> {
    const { payload } = envelope;
    
    switch (envelope.type) {
      case 'TELEGRAM_MESSAGE_CREATED':
        await this.processMessageCreated(envelope, persistence, orchestrator);
        break;
      case 'TELEGRAM_MESSAGE_UPDATED':
        await this.processMessageUpdated(envelope, persistence, orchestrator);
        break;
      case 'TELEGRAM_MESSAGE_DELETED':
        await this.processMessageDeleted(envelope, persistence);
        break;
      case 'TELEGRAM_REACTION_ADDED':
        await this.processReactionAdded(envelope, persistence);
        break;
      case 'TELEGRAM_REACTION_REMOVED':
        await this.processReactionRemoved(envelope, persistence);
        break;
      default:
        console.log(`[telegram-processor] Unhandled event type: ${envelope.type}`);
    }
  }

  private async processMessageCreated(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void> {
    const { payload } = envelope;
    
    if (!payload.text || typeof payload.text !== 'string') {
      throw new Error('Message text is required for scoring');
    }

    // Determine message context
    const context = this.determineMessageContext(payload);
    console.log(`[telegram-processor] Processing ${context} message from ${payload.from?.id}`);

    // Step 1: Create/update platform user
    const platformUser = await persistence.upsertPlatformUser(
      undefined, // userId is optional - can be linked later
      envelope.platform,
      payload.from?.id?.toString() || 'anonymous',
      payload.from?.first_name || payload.from?.username,
      undefined // Telegram doesn't have avatar URLs in basic message data
    );

    // Step 2: Create/update source (Telegram chat)
    const source = await persistence.upsertSource(
      envelope.platform,
      payload.chat?.id?.toString() || 'unknown',
      envelope.projectId,
      `Telegram Chat ${payload.chat?.id}`,
      `Chat type: ${payload.chat?.type || 'unknown'}`
    );

    // Step 3: Save message to database
    const message = await persistence.saveMessage({
      projectId: envelope.projectId,
      sourceId: source.id,
      externalId: payload.message_id?.toString() || 'unknown',
      authorId: platformUser.id,
      content: payload.text,
      contentLang: 'en' // TODO: Add language detection
    });

    // Step 4: Score the message using the orchestrator
    const result = await orchestrator.score({
      text: payload.text,
      projectId: process.env.TEC_CHAT_ID || envelope.projectId,
      context: {
        messageId: payload.message_id?.toString(),
        authorId: payload.from?.id?.toString(),
        timestamp: envelope.ts,
        messageContext: context,
        platform: envelope.platform
      },
    });

    console.log(`[telegram-processor] Scored ${context} message ${payload.message_id}: ${result.finalScore.toFixed(3)}`);

    // Step 5: Save score to database
    await persistence.saveScore({
      messageId: message.id,
      platformUserId: platformUser.id,
      kind: 'overall',
      value: result.finalScore,
      details: {
        sentiment: result.breakdown.sentiment,
        value: result.breakdown.value,
        uniqueness: result.breakdown.uniqueness,
        processingTimeMs: result.metadata.processingTimeMs,
        models: result.metadata.models,
        timestamp: result.metadata.timestamp,
        messageContext: context
      }
    });

    // Step 6: Handle message relations (replies, forwards, etc.)
    await this.handleMessageRelations(envelope, persistence, message.id);

    console.log(`[telegram-processor] Processed ${context} message ${payload.message_id}`);
  }

  private async processMessageUpdated(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void> {
    const { payload } = envelope;
    
    // Find existing message
    const source = await persistence.getSource(envelope.platform, payload.chat?.id?.toString() || 'unknown');
    if (!source) {
      console.log(`[telegram-processor] Source not found for chat ${payload.chat?.id}`);
      return;
    }

    const message = await persistence.getMessageByExternalId(source.id, payload.message_id?.toString() || 'unknown');
    if (!message) {
      console.log(`[telegram-processor] Message not found: ${payload.message_id}`);
      return;
    }

    // Update message content
    await persistence.updateMessage(message.id, {
      content: payload.text || '',
      isDeleted: false
    });

    // Re-score the updated message
    if (payload.text) {
      const result = await orchestrator.score({
        text: payload.text,
        projectId: process.env.TEC_CHAT_ID || envelope.projectId,
        context: {
          messageId: payload.message_id?.toString(),
          authorId: payload.from?.id?.toString(),
          timestamp: envelope.ts,
          messageContext: 'updated',
          platform: envelope.platform
        },
      });

      // Update or create new score
      await persistence.saveScore({
        messageId: message.id,
        platformUserId: message.authorId,
        kind: 'overall',
        value: result.finalScore,
        details: {
          sentiment: result.breakdown.sentiment,
          value: result.breakdown.value,
          uniqueness: result.breakdown.uniqueness,
          processingTimeMs: result.metadata.processingTimeMs,
          models: result.metadata.models,
          timestamp: result.metadata.timestamp,
          messageContext: 'updated'
        }
      });

      console.log(`[telegram-processor] Updated and re-scored message ${payload.message_id}: ${result.finalScore.toFixed(3)}`);
    }
  }

  private async processMessageDeleted(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    // Find and mark message as deleted
    const source = await persistence.getSource(envelope.platform, payload.chat?.id?.toString() || 'unknown');
    if (!source) return;

    const message = await persistence.getMessageByExternalId(source.id, payload.message_id?.toString() || 'unknown');
    if (!message) return;

    await persistence.updateMessage(message.id, {
      isDeleted: true
    });

    console.log(`[telegram-processor] Marked message ${payload.message_id} as deleted`);
  }

  private async processReactionAdded(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    // Find the message
    const source = await persistence.getSource(envelope.platform, payload.chat?.id?.toString() || 'unknown');
    if (!source) return;

    const message = await persistence.getMessageByExternalId(source.id, payload.message_id?.toString() || 'unknown');
    if (!message) return;

    // Find or create platform user for the reactor
    const platformUser = await persistence.upsertPlatformUser(
      undefined,
      envelope.platform,
      payload.user?.id?.toString() || 'anonymous',
      payload.user?.first_name || payload.user?.username
    );

    // Add reaction
    await persistence.addReaction({
      messageId: message.id,
      platformUserId: platformUser.id,
      kind: payload.reaction?.emoji || 'unknown',
      weight: 1
    });

    console.log(`[telegram-processor] Added reaction ${payload.reaction?.emoji} to message ${payload.message_id}`);
  }

  private async processReactionRemoved(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    // Find the message
    const source = await persistence.getSource(envelope.platform, payload.chat?.id?.toString() || 'unknown');
    if (!source) return;

    const message = await persistence.getMessageByExternalId(source.id, payload.message_id?.toString() || 'unknown');
    if (!message) return;

    // Find platform user for the reactor
    const platformUser = await persistence.getPlatformUser(envelope.platform, payload.user?.id?.toString() || 'anonymous');
    if (!platformUser) return;

    // Remove reaction
    await persistence.removeReaction(
      message.id,
      platformUser.id,
      payload.reaction?.emoji || 'unknown'
    );

    console.log(`[telegram-processor] Removed reaction ${payload.reaction?.emoji} from message ${payload.message_id}`);
  }

  private determineMessageContext(payload: any): MessageContext {
    // Check if it's a private chat
    if (payload.chat?.type === 'private') {
      return MessageContext.DM;
    }

    // Check if it's a reply
    if (payload.reply_to_message) {
      return MessageContext.REPLY;
    }

    // Check if it's a forwarded message
    if (payload.forward_from || payload.forward_from_chat) {
      return MessageContext.COMMENT; // Could create a FORWARDED context
    }

    // Default to comment
    return MessageContext.COMMENT;
  }

  private async handleMessageRelations(envelope: EventEnvelope<any>, persistence: any, messageId: string): Promise<void> {
    const { payload } = envelope;
    
    // Handle reply relationships
    if (payload.reply_to_message) {
      const source = await persistence.getSource(envelope.platform, payload.chat?.id?.toString() || 'unknown');
      if (source) {
        const referencedMessage = await persistence.getMessageByExternalId(
          source.id, 
          payload.reply_to_message.message_id?.toString() || 'unknown'
        );
        if (referencedMessage) {
          await persistence.addMessageRelation(
            messageId,
            referencedMessage.id,
            'REPLY_TO' as any
          );
        }
      }
    }

    // Handle forwarded message relationships
    if (payload.forward_from || payload.forward_from_chat) {
      // Could add logic to track forwarded messages
      console.log(`[telegram-processor] Message ${payload.message_id} is forwarded`);
    }
  }
}
