import { query, queryOne, execute } from '../config/database';
import { logger } from '../utils/logger';
import { smsService } from './smsService';
import { config } from '../config';
import { MessageStatus, QueueStatus, Message, MessageQueue } from '../types/database';

interface QueuedMessage {
  messageId: string;
  phoneNumber: string;
  content: string;
  clientId: string;
}

class MessageQueueService {
  private isProcessing: boolean = false;
  private processInterval: NodeJS.Timeout | null = null;
  
  start() {
    if (this.processInterval) {
      logger.warn('Message queue processor already running');
      return;
    }
    
    logger.info('Starting message queue processor');
    this.processInterval = setInterval(() => {
      this.processQueue();
    }, config.queue.processIntervalMs);
    
    // Initial process
    this.processQueue();
  }
  
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('Message queue processor stopped');
    }
  }
  
  async addToQueue(
    clientId: string,
    phoneNumber: string,
    content: string
  ): Promise<string> {
    // Create message record
    const message = await queryOne<Message>(
      `INSERT INTO "Message" (id, "clientId", "phoneNumber", content, status, "retryCount", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, NOW(), NOW())
       RETURNING *`,
      [clientId, phoneNumber, content, MessageStatus.QUEUED]
    );
    
    if (!message) {
      throw new Error('Failed to create message');
    }
    
    // Add to queue
    await execute(
      `INSERT INTO "MessageQueue" (id, "messageId", priority, attempts, "maxAttempts", "nextRetry", status, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 0, 0, $2, NOW(), $3, NOW(), NOW())`,
      [message.id, config.rateLimits.maxRetries, QueueStatus.PENDING]
    );
    
    logger.info(`Message ${message.id} added to queue for ${phoneNumber}`);
    return message.id;
  }
  
  async addBulkToQueue(
    messages: Array<{ clientId: string; phoneNumber: string; content: string }>
  ): Promise<string[]> {
    const messageIds: string[] = [];
    
    for (const msg of messages) {
      const messageId = await this.addToQueue(msg.clientId, msg.phoneNumber, msg.content);
      messageIds.push(messageId);
    }
    
    return messageIds;
  }
  
  private async processQueue() {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Get pending messages from queue
      const queuedItems = await query<MessageQueue>(
        `SELECT * FROM "MessageQueue" 
         WHERE status = $1 
         AND "nextRetry" <= NOW() 
         AND attempts < $2
         ORDER BY priority DESC, "createdAt" ASC
         LIMIT $3`,
        [QueueStatus.PENDING, config.rateLimits.maxRetries, config.queue.batchSize]
      );
      
      for (const queueItem of queuedItems) {
        await this.processQueueItem(queueItem.id, queueItem.messageId);
      }
    } catch (error) {
      logger.error(`Error processing queue: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isProcessing = false;
    }
  }
  
  private async processQueueItem(queueId: string, messageId: string) {
    try {
      // Update queue status
      await execute(
        'UPDATE "MessageQueue" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
        [QueueStatus.PROCESSING, queueId]
      );
      
      // Get message details
      const message = await queryOne<Message>(
        'SELECT * FROM "Message" WHERE id = $1',
        [messageId]
      );
      
      if (!message) {
        logger.error(`Message ${messageId} not found`);
        await execute(
          'UPDATE "MessageQueue" SET status = $1, "lastError" = $2, "updatedAt" = NOW() WHERE id = $3',
          [QueueStatus.FAILED, 'Message not found', queueId]
        );
        return;
      }
      
      // Update message status
      await execute(
        'UPDATE "Message" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
        [MessageStatus.SENDING, messageId]
      );
      
      // Send SMS
      const result = await smsService.sendSms(message.phoneNumber, message.content);
      
      if (result.success) {
        // Success - mark as completed
        await execute(
          'UPDATE "Message" SET status = $1, "sentAt" = NOW(), "updatedAt" = NOW() WHERE id = $2',
          [MessageStatus.SENT, messageId]
        );
        
        await execute(
          'UPDATE "MessageQueue" SET status = $1, "updatedAt" = NOW() WHERE id = $2',
          [QueueStatus.COMPLETED, queueId]
        );
        
        logger.info(`Message ${messageId} sent successfully`);
      } else if (result.retryable) {
        // Retryable error
        const queueItem = await queryOne<MessageQueue>(
          'SELECT * FROM "MessageQueue" WHERE id = $1',
          [queueId]
        );
        
        const newAttempts = (queueItem?.attempts || 0) + 1;
        const isDeadLetter = newAttempts >= config.rateLimits.maxRetries;
        const nextRetry = new Date(Date.now() + config.rateLimits.retryDelayMs * Math.pow(2, newAttempts - 1));
        
        await execute(
          'UPDATE "MessageQueue" SET status = $1, attempts = $2, "lastError" = $3, "nextRetry" = $4, "updatedAt" = NOW() WHERE id = $5',
          [isDeadLetter ? QueueStatus.DEAD_LETTER : QueueStatus.PENDING, newAttempts, result.error, nextRetry, queueId]
        );
        
        await execute(
          'UPDATE "Message" SET status = $1, "retryCount" = $2, "errorMessage" = $3, "updatedAt" = NOW() WHERE id = $4',
          [isDeadLetter ? MessageStatus.FAILED : MessageStatus.QUEUED, newAttempts, result.error, messageId]
        );
        
        logger.warn(`Message ${messageId} will be retried (attempt ${newAttempts})`);
      } else {
        // Non-retryable error
        await execute(
          'UPDATE "Message" SET status = $1, "errorMessage" = $2, "updatedAt" = NOW() WHERE id = $3',
          [MessageStatus.FAILED, result.error, messageId]
        );
        
        await execute(
          'UPDATE "MessageQueue" SET status = $1, "lastError" = $2, "updatedAt" = NOW() WHERE id = $3',
          [QueueStatus.FAILED, result.error, queueId]
        );
        
        logger.error(`Message ${messageId} failed permanently: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing queue item ${queueId}: ${errorMsg}`);
      
      const nextRetry = new Date(Date.now() + config.rateLimits.retryDelayMs);
      await execute(
        'UPDATE "MessageQueue" SET status = $1, "lastError" = $2, "nextRetry" = $3, "updatedAt" = NOW() WHERE id = $4',
        [QueueStatus.PENDING, errorMsg, nextRetry, queueId]
      );
    }
  }
  
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
  }> {
    const result = await query<{ status: QueueStatus; count: string }>(
      'SELECT status, COUNT(*) as count FROM "MessageQueue" GROUP BY status'
    );
    
    const stats: Record<string, number> = {};
    for (const row of result) {
      stats[row.status] = parseInt(row.count, 10);
    }
    
    return {
      pending: stats[QueueStatus.PENDING] || 0,
      processing: stats[QueueStatus.PROCESSING] || 0,
      completed: stats[QueueStatus.COMPLETED] || 0,
      failed: stats[QueueStatus.FAILED] || 0,
      deadLetter: stats[QueueStatus.DEAD_LETTER] || 0,
    };
  }
  
  async retryDeadLetterMessages(): Promise<number> {
    const result = await execute(
      'UPDATE "MessageQueue" SET status = $1, attempts = 0, "nextRetry" = NOW(), "updatedAt" = NOW() WHERE status = $2',
      [QueueStatus.PENDING, QueueStatus.DEAD_LETTER]
    );
    
    logger.info(`Reset ${result.rowCount} dead letter messages for retry`);
    return result.rowCount;
  }
}

export const messageQueueService = new MessageQueueService();
