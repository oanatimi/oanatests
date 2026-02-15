import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Get all clients with pagination and search
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const county = req.query.county as string;
    const category = req.query.category as string;
    const sortBy = req.query.sortBy as string || 'companyName';
    const sortOrder = (req.query.sortOrder as string || 'asc') === 'desc' ? 'desc' : 'asc';
    
    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { phonePrimary: { contains: search } },
        { emailPrimary: { contains: search, mode: 'insensitive' } },
        { administrator: { contains: search, mode: 'insensitive' } },
        { observations: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (county) {
      where.county = county;
    }
    
    if (category) {
      where.category = category;
    }
    
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);
    
    res.json({
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error fetching clients: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get distinct counties for filtering
router.get('/counties', async (_req: Request, res: Response) => {
  try {
    const counties = await prisma.client.findMany({
      select: { county: true },
      distinct: ['county'],
      where: { county: { not: null } },
      orderBy: { county: 'asc' },
    });
    
    res.json(counties.map(c => c.county).filter(Boolean));
  } catch (error) {
    logger.error(`Error fetching counties: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch counties' });
  }
});

// Get distinct categories for filtering
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.client.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } },
      orderBy: { category: 'asc' },
    });
    
    res.json(categories.map(c => c.category).filter(Boolean));
  } catch (error) {
    logger.error(`Error fetching categories: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single client with message history
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    
    res.json(client);
  } catch (error) {
    logger.error(`Error fetching client: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Update client
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updateData = req.body;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.messages;
    
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: updateData,
    });
    
    res.json(client);
  } catch (error) {
    logger.error(`Error updating client: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.client.delete({
      where: { id: req.params.id },
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting client: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;
