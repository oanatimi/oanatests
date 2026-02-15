import { Router, Request, Response } from 'express';
import { Prisma, MessageStatus } from '@prisma/client';
import prisma from '../config/database';
import { messageQueueService } from '../services/messageQueueService';
import { smsService } from '../services/smsService';
import { config } from '../config';
import { handleError, sendValidationError, sendNotFoundError } from '../utils/errorHandler';

const router = Router();

// Max message length for validation
const MAX_MESSAGE_LENGTH = config.smsBestPractices.maxLength;

// Phone number format validation (E.164 format)
function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: + followed by 7-15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  // Also allow numbers starting with 0 (will be normalized later)
  const localRegex = /^0[1-9]\d{7,10}$/;
  return e164Regex.test(phone) || localRegex.test(phone);
}

// Get all messages with pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as MessageStatus;
    const clientId = req.query.clientId as string;
    
    const where: Prisma.MessageWhereInput = {};
    
    if (status) {
      where.status = status;
    }
    
    if (clientId) {
      where.clientId = clientId;
    }
    
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              phonePrimary: true,
            },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    handleError(res, error, 'Error fetching messages');
  }
});

// Send message to a single client
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { clientId, content, phoneNumber } = req.body;
    
    if (!clientId || !content) {
      sendValidationError(res, 'Please provide both a client and message content.');
      return;
    }
    
    // Validate message content length before queuing
    if (typeof content !== 'string' || content.trim().length === 0) {
      sendValidationError(res, 'Message content cannot be empty. Please enter a message.');
      return;
    }
    
    if (content.length > MAX_MESSAGE_LENGTH) {
      sendValidationError(res, `Your message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters (current: ${content.length}).`);
      return;
    }
    
    // Get client phone if not provided
    let phone = phoneNumber;
    if (!phone) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { phonePrimary: true, phoneContact: true, companyName: true },
      });
      
      if (!client) {
        sendNotFoundError(res, 'Client');
        return;
      }
      
      phone = client.phonePrimary || client.phoneContact;
    }
    
    if (!phone) {
      sendValidationError(res, 'This client does not have a phone number. Please add a phone number first.');
      return;
    }
    
    // Validate phone number format
    if (!isValidPhoneNumber(phone)) {
      sendValidationError(res, 'The phone number format is invalid. Please use a valid phone number format.');
      return;
    }
    
    const messageId = await messageQueueService.addToQueue(clientId, phone, content);
    
    res.json({
      success: true,
      data: { messageId },
      message: 'Your message has been queued and will be sent shortly.',
    });
  } catch (error) {
    handleError(res, error, 'Error sending message');
  }
});

// Send bulk messages
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { clientIds, content } = req.body;
    
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      sendValidationError(res, 'Please select at least one client to send messages to.');
      return;
    }
    
    if (!content) {
      sendValidationError(res, 'Please enter a message to send.');
      return;
    }
    
    // Validate message content length before queuing
    if (typeof content !== 'string' || content.trim().length === 0) {
      sendValidationError(res, 'Message content cannot be empty. Please enter a message.');
      return;
    }
    
    if (content.length > MAX_MESSAGE_LENGTH) {
      sendValidationError(res, `Your message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters (current: ${content.length}).`);
      return;
    }
    
    // Get clients with phone numbers
    const clients = await prisma.client.findMany({
      where: {
        id: { in: clientIds },
      },
      select: {
        id: true,
        phonePrimary: true,
        phoneContact: true,
        companyName: true,
      },
    });
    
    const messages = clients
      .filter(c => c.phonePrimary || c.phoneContact)
      .map(c => ({
        clientId: c.id,
        phoneNumber: (c.phonePrimary || c.phoneContact) as string,
        content,
      }));
    
    const skipped = clients.length - messages.length;
    
    if (messages.length === 0) {
      sendValidationError(res, 'None of the selected clients have valid phone numbers. Please add phone numbers first.');
      return;
    }
    
    const messageIds = await messageQueueService.addBulkToQueue(messages);
    
    res.json({
      success: true,
      data: {
        queued: messageIds.length,
        skipped,
      },
      message: `${messageIds.length} message(s) queued for sending.${skipped > 0 ? ` ${skipped} client(s) skipped due to missing phone numbers.` : ''}`,
    });
  } catch (error) {
    handleError(res, error, 'Error sending bulk messages');
  }
});

// Get queue status
router.get('/queue/status', async (_req: Request, res: Response) => {
  try {
    const queueStats = await messageQueueService.getQueueStats();
    const rateLimitStatus = smsService.getRateLimitStatus();
    
    res.json({
      success: true,
      data: {
        queue: queueStats,
        rateLimit: rateLimitStatus,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error fetching queue status');
  }
});

// Retry dead letter messages
router.post('/queue/retry-dead-letters', async (_req: Request, res: Response) => {
  try {
    const count = await messageQueueService.retryDeadLetterMessages();
    
    res.json({
      success: true,
      data: { retriedCount: count },
      message: count > 0 ? `${count} failed message(s) have been queued for retry.` : 'No failed messages to retry.',
    });
  } catch (error) {
    handleError(res, error, 'Error retrying dead letters');
  }
});

// Get message templates
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    
    res.json({ success: true, data: templates });
  } catch (error) {
    handleError(res, error, 'Error fetching templates');
  }
});

// Create message template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, content } = req.body;
    
    if (!name || !content) {
      sendValidationError(res, 'Please provide both a name and content for the template.');
      return;
    }
    
    const template = await prisma.messageTemplate.create({
      data: { name, content },
    });
    
    res.json({
      success: true,
      data: template,
      message: 'Template created successfully.',
    });
  } catch (error) {
    handleError(res, error, 'Error creating template');
  }
});

// Update message template
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { name, content } = req.body;
    
    const template = await prisma.messageTemplate.update({
      where: { id: req.params.id },
      data: { name, content },
    });
    
    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully.',
    });
  } catch (error) {
    handleError(res, error, 'Error updating template');
  }
});

// Delete message template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    await prisma.messageTemplate.delete({
      where: { id: req.params.id },
    });
    
    res.json({
      success: true,
      message: 'Template deleted successfully.',
    });
  } catch (error) {
    handleError(res, error, 'Error deleting template');
  }
});

export default router;
