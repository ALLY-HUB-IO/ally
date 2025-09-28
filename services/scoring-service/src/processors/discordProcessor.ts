import { EventEnvelope } from '@ally/events/envelope';
import { EventType } from '@ally/events/catalog';
import { PlatformEventProcessor, MessageContext } from '../types.js';

export class DiscordEventProcessor implements PlatformEventProcessor {
  canHandle(platform: string, eventType: string): boolean {
    return platform === 'discord' && [
      EventType.DISCORD_MESSAGE_CREATED,
      EventType.DISCORD_MESSAGE_UPDATED,
      EventType.DISCORD_MESSAGE_DELETED,
      EventType.DISCORD_REACTION_ADDED,
      EventType.DISCORD_REACTION_REMOVED,
      EventType.DISCORD_THREAD_CREATED,
      EventType.DISCORD_THREAD_DELETED
    ].includes(eventType as any);
  }

  async processEvent(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void> {
    const { payload } = envelope;
    
    switch (envelope.type) {
      case EventType.DISCORD_MESSAGE_CREATED:
        await this.processMessageCreated(envelope, persistence, orchestrator);
        break;
      case EventType.DISCORD_MESSAGE_UPDATED:
        await this.processMessageUpdated(envelope, persistence, orchestrator);
        break;
      case EventType.DISCORD_MESSAGE_DELETED:
        await this.processMessageDeleted(envelope, persistence);
        break;
      case EventType.DISCORD_REACTION_ADDED:
        await this.processReactionAdded(envelope, persistence);
        break;
      case EventType.DISCORD_REACTION_REMOVED:
        await this.processReactionRemoved(envelope, persistence);
        break;
      case EventType.DISCORD_THREAD_CREATED:
        await this.processThreadCreated(envelope, persistence);
        break;
      case EventType.DISCORD_THREAD_DELETED:
        await this.processThreadDeleted(envelope, persistence);
        break;
      default:
        console.log(`[discord-processor] Unhandled event type: ${envelope.type}`);
    }
  }

  private async processMessageCreated(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void> {
    const { payload } = envelope;
    
    if (!payload.content || typeof payload.content !== 'string') {
      throw new Error('Message content is required for scoring');
    }

    // Determine message context
    const context = this.determineMessageContext(payload);

    // Step 1: Create/update platform user (user relationship is optional)
    const platformUser = await persistence.upsertPlatformUser(
      undefined, // userId is optional - can be linked later
      envelope.platform,
      payload.author?.id || 'anonymous',
      payload.author?.displayName || payload.author?.username,
      payload.author?.avatarUrl
    );

    // Step 2: Create/update source (Discord channel)
    const source = await persistence.upsertSource(
      envelope.platform,
      payload.channelId,
      envelope.projectId,
      `Discord Channel ${payload.channelId}`,
      `Channel in guild ${payload.guildId || 'DM'}`
    );

    // Step 3: Check if message already exists, if not create it
    let message = await persistence.getMessageByExternalId(source.id, payload.externalId);
    
    if (!message) {
      // Create new message
      message = await persistence.saveMessage({
        projectId: envelope.projectId,
        sourceId: source.id,
        externalId: payload.externalId,
        authorId: platformUser.id,
        content: payload.content,
        contentLang: 'en' // TODO: Add language detection
      });
    } else {
      // Update existing message if content changed
      if (message.content !== payload.content) {
        message = await persistence.updateMessage(message.id, {
          content: payload.content,
          updatedAt: new Date()
        });
      }
    }

    // Step 4: Save Discord-specific details
    await persistence.saveDiscordMessageDetail(
      message.id,
      payload.guildId,
      payload.channelId,
      payload.threadId,
      payload.embeds,
      payload.attachments
    );

    // Step 5: Score the message using the orchestrator
    const result = await orchestrator.score({
      text: payload.content,
      projectId: process.env.TEC_CHAT_ID || envelope.projectId,
      context: {
        messageId: payload.externalId,
        authorId: payload.author?.id,
        timestamp: envelope.ts,
        messageContext: context,
        platform: envelope.platform
      },
    });

    console.log(`[discord-processor] Scored ${context} message: ${result.finalScore.toFixed(3)}`);

    // Step 6: Save overall score with descriptive label and comprehensive details
    const kind = this.mapScoreToLabel(result.finalScore);
    const details = this.buildScoreDetails(result, context);

    await persistence.saveScore({
      messageId: message.id,
      platformUserId: platformUser.id,
      kind,
      value: result.finalScore,
      details
    });

    // Step 7: Handle message relations (replies, thread parents, etc.)
    await this.handleMessageRelations(envelope, persistence, message.id);

    // Step 8: Publish scored event
    await this.publishScoredEvent(envelope, result, context);
  }

  private async processMessageUpdated(envelope: EventEnvelope<any>, persistence: any, orchestrator: any): Promise<void> {
    const { payload } = envelope;
    
    // Find existing message
    const source = await persistence.getSource(envelope.platform, payload.channelId);
    if (!source) {
      console.log(`[discord-processor] Source not found for channel ${payload.channelId}`);
      return;
    }

    const message = await persistence.getMessageByExternalId(source.id, payload.externalId);
    if (!message) {
      console.log(`[discord-processor] Message not found: ${payload.externalId}`);
      return;
    }

    // Update message content
    await persistence.updateMessage(message.id, {
      content: payload.content,
      isDeleted: false
    });

    // Re-score the updated message
    const result = await orchestrator.score({
      text: payload.content,
      projectId: process.env.TEC_CHAT_ID || envelope.projectId,
      context: {
        messageId: payload.externalId,
        authorId: payload.author?.id,
        timestamp: envelope.ts,
        messageContext: 'updated',
        platform: envelope.platform
      },
    });

    // Update or create new score with descriptive label and comprehensive details
    const kind = this.mapScoreToLabel(result.finalScore);
    const details = this.buildScoreDetails(result, 'updated');

    await persistence.saveScore({
      messageId: message.id,
      platformUserId: message.authorId,
      kind,
      value: result.finalScore,
      details
    });

    console.log(`[discord-processor] Updated and re-scored message: ${result.finalScore.toFixed(3)}`);
  }

  private async processMessageDeleted(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    // Find and mark message as deleted
    const source = await persistence.getSource(envelope.platform, payload.channelId);
    if (!source) return;

    const message = await persistence.getMessageByExternalId(source.id, payload.externalId);
    if (!message) return;

    await persistence.updateMessage(message.id, {
      isDeleted: true
    });

    console.log(`[discord-processor] Message marked as deleted`);
  }

  private async processReactionAdded(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    // Find the message
    const source = await persistence.getSource(envelope.platform, payload.channelId);
    if (!source) return;

    const message = await persistence.getMessageByExternalId(source.id, payload.messageId);
    if (!message) return;

    // Find or create platform user for the reactor
    const platformUser = await persistence.upsertPlatformUser(
      undefined,
      envelope.platform,
      payload.author?.id || 'anonymous',
      payload.author?.displayName || payload.author?.username,
      payload.author?.avatarUrl
    );

    // Add reaction
    await persistence.addReaction({
      messageId: message.id,
      platformUserId: platformUser.id,
      kind: payload.emoji?.name || 'unknown',
      weight: 1
    });

    console.log(`[discord-processor] Reaction added: ${payload.emoji?.name}`);
  }

  private async processReactionRemoved(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    // Find the message
    const source = await persistence.getSource(envelope.platform, payload.channelId);
    if (!source) return;

    const message = await persistence.getMessageByExternalId(source.id, payload.messageId);
    if (!message) return;

    // If we have a valid author ID, try to find the platform user
    if (payload.author?.id && payload.author.id !== 'unknown') {
      const platformUser = await persistence.getPlatformUser(envelope.platform, payload.author.id);
      if (platformUser) {
        // Remove reaction for specific user
        await persistence.removeReaction(
          message.id,
          platformUser.id,
          payload.emoji?.name || 'unknown'
        );
        console.log(`[discord-processor] Reaction removed: ${payload.emoji?.name}`);
        return;
      }
    }

    // If we can't identify the specific user, remove all reactions of this type from the message
    // This is a fallback for when Discord doesn't provide the user who removed the reaction
    console.log(`[discord-processor] Reaction removed (fallback): ${payload.emoji?.name}`);
    
    // Get all reactions for this message and remove the ones matching the emoji
    const reactions = await persistence.getReactionsByMessage(message.id);
    for (const reaction of reactions) {
      if (reaction.kind === payload.emoji?.name) {
        await persistence.removeReaction(message.id, reaction.platformUserId, reaction.kind);
      }
    }
  }

  private determineMessageContext(payload: any): MessageContext {
    // Check if it's a DM
    if (!payload.guildId) {
      return MessageContext.DM;
    }

    // Check if it's a thread
    if (payload.threadId) {
      return MessageContext.THREAD_ANSWER;
    }

    // Check if it's a reply (has referenced message)
    if (payload.referencedMessage) {
      return MessageContext.REPLY;
    }

    // Default to comment
    return MessageContext.COMMENT;
  }

  private async handleMessageRelations(envelope: EventEnvelope<any>, persistence: any, messageId: string): Promise<void> {
    const { payload } = envelope;
    
    // Skip message relations for thread messages to avoid conflicts
    if (payload.threadId && payload.threadId !== payload.channelId) {
      return;
    }
    
    // Handle reply relationships (only for non-thread messages)
    if (payload.referencedMessage) {
      // The referenced message might be in a different channel, so we need to find the right source
      const referencedChannelId = payload.referencedMessage.channelId || payload.channelId;
      const source = await persistence.getSource(envelope.platform, referencedChannelId);
      
      if (source) {
        const referencedMessage = await persistence.getMessageByExternalId(source.id, payload.referencedMessage.id);
        if (referencedMessage) {
          try {
            await persistence.addMessageRelation(
              messageId,
              referencedMessage.id,
              'REPLY_TO' as any
            );
            console.log(`[discord-processor] Reply relation created`);
          } catch (error) {
            console.log(`[discord-processor] Failed to add reply relation: ${(error as Error).message}`);
          }
        }
      }
    }
  }

  private async processThreadCreated(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    // Find the starter message in our database
    const source = await persistence.getSource(envelope.platform, payload.parentChannelId);
    if (!source) {
      return;
    }
    
    const starterMessage = await persistence.getMessageByExternalId(source.id, payload.starterMessageId);
    if (!starterMessage) {
      return;
    }
    
    // Update the DiscordMessageDetail for the starter message to include the threadId
    try {
      await persistence.updateDiscordMessageDetail(starterMessage.id, {
        threadId: payload.threadId
      });
      console.log(`[discord-processor] Thread created: ${payload.threadName}`);
    } catch (error) {
      console.log(`[discord-processor] Failed to update starter message with threadId: ${(error as Error).message}`);
    }
  }

  private async processThreadDeleted(envelope: EventEnvelope<any>, persistence: any): Promise<void> {
    const { payload } = envelope;
    
    console.log(`[discord-processor] Processing thread deletion: ${payload.threadName} (${payload.threadId})`);
    
    // Find the source for the parent channel
    const source = await persistence.getSource(envelope.platform, payload.parentChannelId);
    if (!source) {
      console.log(`[discord-processor] Source not found for parent channel: ${payload.parentChannelId}`);
      return;
    }
    
    // Get all messages in this thread from DiscordMessageDetail
    const threadMessages = await persistence.getMessagesByThreadId(payload.threadId);
    
    if (threadMessages.length === 0) {
      console.log(`[discord-processor] No messages found for thread: ${payload.threadId}`);
      return;
    }
    
    // Find the starter message (the one that created the thread)
    // The starter message should be the one with the same externalId as the threadId
    const starterMessage = threadMessages.find((msg: any) => msg.externalId === payload.threadId);
    const otherMessages = threadMessages.filter((msg: any) => msg.externalId !== payload.threadId);
    
    // Mark all non-starter messages as deleted
    for (const message of otherMessages) {
      try {
        await persistence.updateMessage(message.id, {
          isDeleted: true
        });
      } catch (error) {
        console.log(`[discord-processor] Failed to mark message as deleted: ${(error as Error).message}`);
      }
    }
    
    // For the starter message, just remove the threadId from DiscordMessageDetail
    if (starterMessage) {
      try {
        await persistence.updateDiscordMessageDetail(starterMessage.id, {
          threadId: null
        });
        console.log(`[discord-processor] Thread deleted: ${payload.threadName} (${otherMessages.length} messages marked as deleted)`);
      } catch (error) {
        console.log(`[discord-processor] Failed to remove threadId from starter message: ${(error as Error).message}`);
      }
    } else {
      console.log(`[discord-processor] Thread deleted: ${payload.threadName} (${otherMessages.length} messages marked as deleted, no starter message found)`);
    }
  }

  private async publishScoredEvent(envelope: EventEnvelope<any>, result: any, context: MessageContext): Promise<void> {
    // This would publish to the scored stream
    // Implementation depends on your Redis setup
  }

  /**
   * Maps a numeric score to a descriptive label
   */
  private mapScoreToLabel(score: number): string {
    if (score <= 0.2) return 'very negative';
    if (score <= 0.4) return 'negative';
    if (score <= 0.6) return 'neutral';
    if (score <= 0.8) return 'positive';
    return 'very positive';
  }

  private mapValueToLabel(score: number): string {
    if (score <= 0.2) return 'very low';
    if (score <= 0.4) return 'low';
    if (score <= 0.6) return 'medium';
    if (score <= 0.8) return 'high';
    return 'very high';
  }

  /**
   * Extracts numeric score from breakdown object
   */
  private extractScore(breakdown: any): number {
    return typeof breakdown.score === 'number' ? breakdown.score : breakdown;
  }

  /**
   * Builds comprehensive score details with all component information
   */
  private buildScoreDetails(result: any, messageContext: string): any {
    const sentimentScore = this.extractScore(result.breakdown.sentiment);
    const valueScore = this.extractScore(result.breakdown.value);
    const uniquenessScore = this.extractScore(result.breakdown.uniqueness);

    return {
      // Overall score information
      overall: {
        score: result.finalScore,
        label: this.mapScoreToLabel(result.finalScore),
        processingTimeMs: result.metadata.processingTimeMs,
        timestamp: result.metadata.timestamp,
        messageContext
      },
      
      // Sentiment component details
      sentiment: {
        score: sentimentScore,
        label: this.mapScoreToLabel(sentimentScore),
        weight: result.breakdown.sentiment.weight || 0.4,
        weightedScore: result.breakdown.sentiment.weightedScore || sentimentScore * 0.4,
        model: result.metadata.models.sentiment,
        breakdown: result.breakdown.sentiment
      },
      
      // Value component details
      value: {
        score: valueScore,
        label: this.mapValueToLabel(parseFloat(valueScore.toString())),
        weight: result.breakdown.value.weight || 0.5,
        weightedScore: result.breakdown.value.weightedScore || valueScore * 0.5,
        model: result.metadata.models.value,
        breakdown: result.breakdown.value
      },
      
      // Uniqueness component details
      uniqueness: {
        score: uniquenessScore,
        label: this.mapScoreToLabel(uniquenessScore),
        weight: result.breakdown.uniqueness.weight || 0.1,
        weightedScore: result.breakdown.uniqueness.weightedScore || uniquenessScore * 0.1,
        model: result.metadata.models.uniqueness || 'cosine-similarity',
        breakdown: result.breakdown.uniqueness
      },
      
      // Metadata
      metadata: {
        models: result.metadata.models,
        processingTimeMs: result.metadata.processingTimeMs,
        timestamp: result.metadata.timestamp,
        messageContext
      }
    };
  }
}
