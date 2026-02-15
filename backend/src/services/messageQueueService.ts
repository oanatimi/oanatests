import prisma from '../config/database';
import { logger } from '../utils/logger';
import { smsService } from './smsService';
import { config } from '../config';
import { MessageStatus, QueueStatus } from '@prisma/client';

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
    const message = await prisma.message.create({
      data: {
        clientId,
        phoneNumber,
        content,
        status: MessageStatus.QUEUED,
      },
    });
    
    // Add to queue
    await prisma.messageQueue.create({
      data: {
        messageId: message.id,
        priority: 0,
        maxAttempts: config.rateLimits.maxRetries,
        status: QueueStatus.PENDING,
      },
    });
    
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
      const queuedItems = await prisma.messageQueue.findMany({
        where: {
          status: QueueStatus.PENDING,
          nextRetry: {
            lte: new Date(),
          },
          attempts: {
            lt: prisma.messageQueue.fields.maxAttempts,
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        take: config.queue.batchSize,
      });
      
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
      await prisma.messageQueue.update({
        where: { id: queueId },
        data: { status: QueueStatus.PROCESSING },
      });
      
      // Get message details
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });
      
      if (!message) {
        logger.error(`Message ${messageId} not found`);
        await prisma.messageQueue.update({
          where: { id: queueId },
          data: { 
            status: QueueStatus.FAILED,
            lastError: 'Message not found',
          },
        });
        return;
      }
      
      // Update message status
      await prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.SENDING },
      });
      
      // Send SMS
      const result = await smsService.sendSms(message.phoneNumber, message.content);
      
      if (result.success) {
        // Success - mark as completed
        await prisma.message.update({
          where: { id: messageId },
          data: {
            status: MessageStatus.SENT,
            sentAt: new Date(),
          },
        });
        
        await prisma.messageQueue.update({
          where: { id: queueId },
          data: { status: QueueStatus.COMPLETED },
        });
        
        logger.info(`Message ${messageId} sent successfully`);
      } else if (result.retryable) {
        // Retryable error
        const queueItem = await prisma.messageQueue.findUnique({
          where: { id: queueId },
        });
        
        const newAttempts = (queueItem?.attempts || 0) + 1;
        const isDeadLetter = newAttempts >= config.rateLimits.maxRetries;
        
        await prisma.messageQueue.update({
          where: { id: queueId },
          data: {
            status: isDeadLetter ? QueueStatus.DEAD_LETTER : QueueStatus.PENDING,
            attempts: newAttempts,
            lastError: result.error,
            nextRetry: new Date(Date.now() + config.rateLimits.retryDelayMs * Math.pow(2, newAttempts - 1)),
          },
        });
        
        await prisma.message.update({
          where: { id: messageId },
          data: {
            status: isDeadLetter ? MessageStatus.FAILED : MessageStatus.QUEUED,
            retryCount: newAttempts,
            errorMessage: result.error,
          },
        });
        
        logger.warn(`Message ${messageId} will be retried (attempt ${newAttempts})`);
      } else {
        // Non-retryable error
        await prisma.message.update({
          where: { id: messageId },
          data: {
            status: MessageStatus.FAILED,
            errorMessage: result.error,
          },
        });
        
        await prisma.messageQueue.update({
          where: { id: queueId },
          data: {
            status: QueueStatus.FAILED,
            lastError: result.error,
          },
        });
        
        logger.error(`Message ${messageId} failed permanently: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing queue item ${queueId}: ${errorMsg}`);
      
      await prisma.messageQueue.update({
        where: { id: queueId },
        data: {
          status: QueueStatus.PENDING,
          lastError: errorMsg,
          nextRetry: new Date(Date.now() + config.rateLimits.retryDelayMs),
        },
      });
    }
  }
  
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
  }> {
    const [pending, processing, completed, failed, deadLetter] = await Promise.all([
      prisma.messageQueue.count({ where: { status: QueueStatus.PENDING } }),
      prisma.messageQueue.count({ where: { status: QueueStatus.PROCESSING } }),
      prisma.messageQueue.count({ where: { status: QueueStatus.COMPLETED } }),
      prisma.messageQueue.count({ where: { status: QueueStatus.FAILED } }),
      prisma.messageQueue.count({ where: { status: QueueStatus.DEAD_LETTER } }),
    ]);
    
    return { pending, processing, completed, failed, deadLetter };
  }
  
  async retryDeadLetterMessages(): Promise<number> {
    const result = await prisma.messageQueue.updateMany({
      where: { status: QueueStatus.DEAD_LETTER },
      data: {
        status: QueueStatus.PENDING,
        attempts: 0,
        nextRetry: new Date(),
      },
    });
    
    logger.info(`Reset ${result.count} dead letter messages for retry`);
    return result.count;
  }
}

export const messageQueueService = new MessageQueueService();
