import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { messageQueueService } from '../services/messageQueueService';
import { smsService } from '../services/smsService';
import { MessageStatus } from '@prisma/client';

const router = Router();

// Get all messages with pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as MessageStatus;
    const clientId = req.query.clientId as string;
    
    const where: Record<string, unknown> = {};
    
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
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching messages: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message to a single client
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { clientId, content, phoneNumber } = req.body;
    
    if (!clientId || !content) {
      res.status(400).json({ error: 'clientId and content are required' });
      return;
    }
    
    // Get client phone if not provided
    let phone = phoneNumber;
    if (!phone) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { phonePrimary: true, phoneContact: true },
      });
      
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      
      phone = client.phonePrimary || client.phoneContact;
    }
    
    if (!phone) {
      res.status(400).json({ error: 'No phone number available for this client' });
      return;
    }
    
    const messageId = await messageQueueService.addToQueue(clientId, phone, content);
    
    res.json({
      success: true,
      messageId,
      message: 'Message queued for sending',
    });
  } catch (error) {
    logger.error(`Error sending message: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send bulk messages
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { clientIds, content } = req.body;
    
    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      res.status(400).json({ error: 'clientIds array is required' });
      return;
    }
    
    if (!content) {
      res.status(400).json({ error: 'content is required' });
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
      res.status(400).json({ error: 'No valid phone numbers found for selected clients' });
      return;
    }
    
    const messageIds = await messageQueueService.addBulkToQueue(messages);
    
    res.json({
      success: true,
      queued: messageIds.length,
      skipped,
      message: `${messageIds.length} messages queued for sending`,
    });
  } catch (error) {
    logger.error(`Error sending bulk messages: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to send bulk messages' });
  }
});

// Get queue status
router.get('/queue/status', async (_req: Request, res: Response) => {
  try {
    const queueStats = await messageQueueService.getQueueStats();
    const rateLimitStatus = smsService.getRateLimitStatus();
    
    res.json({
      queue: queueStats,
      rateLimit: rateLimitStatus,
    });
  } catch (error) {
    logger.error(`Error fetching queue status: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
});

// Retry dead letter messages
router.post('/queue/retry-dead-letters', async (_req: Request, res: Response) => {
  try {
    const count = await messageQueueService.retryDeadLetterMessages();
    
    res.json({
      success: true,
      retriedCount: count,
    });
  } catch (error) {
    logger.error(`Error retrying dead letters: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to retry dead letter messages' });
  }
});

// Get message templates
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    
    res.json(templates);
  } catch (error) {
    logger.error(`Error fetching templates: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create message template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, content } = req.body;
    
    if (!name || !content) {
      res.status(400).json({ error: 'name and content are required' });
      return;
    }
    
    const template = await prisma.messageTemplate.create({
      data: { name, content },
    });
    
    res.json(template);
  } catch (error) {
    logger.error(`Error creating template: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to create template' });
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
    
    res.json(template);
  } catch (error) {
    logger.error(`Error updating template: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete message template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    await prisma.messageTemplate.delete({
      where: { id: req.params.id },
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting template: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
