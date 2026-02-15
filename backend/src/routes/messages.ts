import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { MessageStatus, Message, MessageTemplate, MessageWithClient, Client } from '../types/database';
import { messageQueueService } from '../services/messageQueueService';
import { smsService } from '../services/smsService';
import { config } from '../config';
import { handleError, sendValidationError, sendNotFoundError } from '../utils/errorHandler';

const router = Router();

// Max message length for validation
const MAX_MESSAGE_LENGTH = config.smsBestPractices.maxLength;

// Phone number format validation (E.164 format)
// Note: E.164 allows 7-15 digits but some regions have shorter numbers
// We use 7 as minimum to cover most international numbers while excluding invalid short strings
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
    
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (status) {
      conditions.push(`m.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (clientId) {
      conditions.push(`m."clientId" = $${paramIndex}`);
      params.push(clientId);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const messagesQuery = `
      SELECT m.*, 
        c.id as "client_id", c."companyName" as "client_companyName", c."phonePrimary" as "client_phonePrimary"
      FROM "Message" m
      LEFT JOIN "Client" c ON m."clientId" = c.id
      ${whereClause}
      ORDER BY m."createdAt" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM "Message" m ${whereClause}`;
    
    const [messagesRaw, countResult] = await Promise.all([
      query<Message & { client_id: string; client_companyName: string; client_phonePrimary: string | null }>(messagesQuery, [...params, limit, offset]),
      query<{ total: string }>(countQuery, params),
    ]);
    
    // Transform to include client object
    const messages: MessageWithClient[] = messagesRaw.map(m => ({
      id: m.id,
      clientId: m.clientId,
      phoneNumber: m.phoneNumber,
      content: m.content,
      status: m.status,
      sentAt: m.sentAt,
      deliveredAt: m.deliveredAt,
      errorMessage: m.errorMessage,
      retryCount: m.retryCount,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      client: m.client_id ? {
        id: m.client_id,
        companyName: m.client_companyName,
        phonePrimary: m.client_phonePrimary,
      } : undefined,
    }));
    
    const total = parseInt(countResult[0]?.total || '0', 10);
    
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
      const client = await queryOne<Client>(
        'SELECT "phonePrimary", "phoneContact", "companyName" FROM "Client" WHERE id = $1',
        [clientId]
      );
      
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
    
    // Get clients with phone numbers using ANY with array parameter (safe from SQL injection)
    const clients = await query<Client>(
      `SELECT id, "phonePrimary", "phoneContact", "companyName" FROM "Client" WHERE id = ANY($1::text[])`,
      [clientIds]
    );
    
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
    const templates = await query<MessageTemplate>(
      'SELECT * FROM "MessageTemplate" ORDER BY name ASC'
    );
    
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
    
    const template = await queryOne<MessageTemplate>(
      `INSERT INTO "MessageTemplate" (id, name, content, "createdAt", "updatedAt") 
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) 
       RETURNING *`,
      [name, content]
    );
    
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
    
    const template = await queryOne<MessageTemplate>(
      `UPDATE "MessageTemplate" SET name = $1, content = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *`,
      [name, content, req.params.id]
    );
    
    if (!template) {
      sendNotFoundError(res, 'Template');
      return;
    }
    
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
    const result = await execute(
      'DELETE FROM "MessageTemplate" WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rowCount === 0) {
      sendNotFoundError(res, 'Template');
      return;
    }
    
    res.json({
      success: true,
      message: 'Template deleted successfully.',
    });
  } catch (error) {
    handleError(res, error, 'Error deleting template');
  }
});

export default router;
