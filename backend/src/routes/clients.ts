import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { handleError, sendNotFoundError } from '../utils/errorHandler';

const router = Router();

// Whitelist of allowed sort fields for security
const ALLOWED_SORT_FIELDS = ['companyName', 'county', 'createdAt', 'updatedAt', 'category', 'administrator'] as const;
type AllowedSortField = typeof ALLOWED_SORT_FIELDS[number];

function isAllowedSortField(field: string): field is AllowedSortField {
  return ALLOWED_SORT_FIELDS.includes(field as AllowedSortField);
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
    const sortOrder = (req.query.sortOrder as string || 'asc') === 'desc' ? 'desc' : 'asc';
    
    // Validate sortBy against whitelist to prevent injection
    const sortBy: AllowedSortField = isAllowedSortField(sortByParam) ? sortByParam : 'companyName';
    
    const where: Prisma.ClientWhereInput = {};
    
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { cui: { contains: search, mode: 'insensitive' } },
        { caenCode: { contains: search, mode: 'insensitive' } },
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
      success: true,
      data: clients,
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
    const counties = await prisma.client.findMany({
      select: { county: true },
      distinct: ['county'],
      where: { county: { not: null } },
      orderBy: { county: 'asc' },
    });
    
    res.json({ success: true, data: counties.map(c => c.county).filter(Boolean) });
  } catch (error) {
    handleError(res, error, 'Error fetching counties');
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
    
    res.json({ success: true, data: categories.map(c => c.category).filter(Boolean) });
  } catch (error) {
    handleError(res, error, 'Error fetching categories');
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
      sendNotFoundError(res, 'Client');
      return;
    }
    
    res.json({ success: true, data: client });
  } catch (error) {
    handleError(res, error, 'Error fetching client');
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
    
    res.json({ success: true, data: client, message: 'Client updated successfully.' });
  } catch (error) {
    handleError(res, error, 'Error updating client');
  }
});

// Delete client
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.client.delete({
      where: { id: req.params.id },
    });
    
    res.json({ success: true, message: 'Client deleted successfully.' });
  } catch (error) {
    handleError(res, error, 'Error deleting client');
  }
});

export default router;
