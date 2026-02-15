import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import { handleError, sendNotFoundError } from '../utils/errorHandler';
import { Client, ClientWithMessageCount, ClientWithMessages, Message } from '../types/database';

const router = Router();

// Whitelist of allowed sort fields for security - maps to actual column names
const ALLOWED_SORT_FIELDS: Record<string, string> = {
  'companyName': '"companyName"',
  'county': 'county',
  'createdAt': '"createdAt"',
  'updatedAt': '"updatedAt"',
  'category': 'category',
  'administrator': 'administrator',
};

function getSortColumn(field: string): string {
  return ALLOWED_SORT_FIELDS[field] || '"companyName"';
}

// Get all clients with pagination and search
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const county = req.query.county as string;
    const category = req.query.category as string;
    const sortByParam = req.query.sortBy as string || 'companyName';
    const sortOrder = (req.query.sortOrder as string || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    const sortColumn = getSortColumn(sortByParam);
    const offset = (page - 1) * limit;
    
    // Build WHERE conditions
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (search) {
      conditions.push(`(
        "companyName" ILIKE $${paramIndex} OR
        cui ILIKE $${paramIndex} OR
        "caenCode" ILIKE $${paramIndex} OR
        "phonePrimary" LIKE $${paramIndex} OR
        "emailPrimary" ILIKE $${paramIndex} OR
        administrator ILIKE $${paramIndex} OR
        observations ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (county) {
      conditions.push(`county = $${paramIndex}`);
      params.push(county);
      paramIndex++;
    }
    
    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Query clients with message count
    const clientsQuery = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM "Message" m WHERE m."clientId" = c.id) as "messageCount"
      FROM "Client" c
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM "Client" c ${whereClause}`;
    
    const [clients, countResult] = await Promise.all([
      query<ClientWithMessageCount>(clientsQuery, [...params, limit, offset]),
      query<{ total: string }>(countQuery, params),
    ]);
    
    // Transform messageCount to _count format for compatibility
    const clientsWithCount = clients.map(c => ({
      ...c,
      _count: { messages: parseInt(String(c.messageCount || 0), 10) },
    }));
    
    const total = parseInt(countResult[0]?.total || '0', 10);
    
    res.json({
      success: true,
      data: clientsWithCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    handleError(res, error, 'Error fetching clients');
  }
});

// Get distinct counties for filtering
router.get('/counties', async (_req: Request, res: Response) => {
  try {
    const counties = await query<{ county: string }>(
      'SELECT DISTINCT county FROM "Client" WHERE county IS NOT NULL ORDER BY county ASC'
    );
    
    res.json({ success: true, data: counties.map(c => c.county).filter(Boolean) });
  } catch (error) {
    handleError(res, error, 'Error fetching counties');
  }
});

// Get distinct categories for filtering
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await query<{ category: string }>(
      'SELECT DISTINCT category FROM "Client" WHERE category IS NOT NULL ORDER BY category ASC'
    );
    
    res.json({ success: true, data: categories.map(c => c.category).filter(Boolean) });
  } catch (error) {
    handleError(res, error, 'Error fetching categories');
  }
});

// Get single client with message history
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const client = await queryOne<Client>(
      'SELECT * FROM "Client" WHERE id = $1',
      [req.params.id]
    );
    
    if (!client) {
      sendNotFoundError(res, 'Client');
      return;
    }
    
    // Get messages for this client
    const messages = await query<Message>(
      'SELECT * FROM "Message" WHERE "clientId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
      [req.params.id]
    );
    
    const clientWithMessages: ClientWithMessages = { ...client, messages };
    
    res.json({ success: true, data: clientWithMessages });
  } catch (error) {
    handleError(res, error, 'Error fetching client');
  }
});

// Update client
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.messages;
    delete updateData._count;
    delete updateData.messageCount;
    
    // Build UPDATE query dynamically
    const fields = Object.keys(updateData);
    if (fields.length === 0) {
      res.json({ success: true, data: await queryOne<Client>('SELECT * FROM "Client" WHERE id = $1', [req.params.id]), message: 'No changes made.' });
      return;
    }
    
    const setClause = fields.map((field, index) => `"${field}" = $${index + 1}`).join(', ');
    const values = fields.map(field => updateData[field]);
    
    const updateQuery = `
      UPDATE "Client" 
      SET ${setClause}, "updatedAt" = NOW() 
      WHERE id = $${fields.length + 1} 
      RETURNING *
    `;
    
    const client = await queryOne<Client>(updateQuery, [...values, req.params.id]);
    
    if (!client) {
      sendNotFoundError(res, 'Client');
      return;
    }
    
    res.json({ success: true, data: client, message: 'Client updated successfully.' });
  } catch (error) {
    handleError(res, error, 'Error updating client');
  }
});

// Delete client
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Messages will be deleted by ON DELETE CASCADE
    const result = await execute(
      'DELETE FROM "Client" WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rowCount === 0) {
      sendNotFoundError(res, 'Client');
      return;
    }
    
    res.json({ success: true, message: 'Client deleted successfully.' });
  } catch (error) {
    handleError(res, error, 'Error deleting client');
  }
});

export default router;
