import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { prisma } from '../db/client';

const router = Router();

// Validation schemas
const userRankingQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('trust', 'messages', 'avgScore', 'createdAt').default('trust'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().optional(),
  minTrust: Joi.number().min(0).max(1).optional(),
  maxTrust: Joi.number().min(0).max(1).optional()
});

// GET /api/users/rankings - Get user rankings
router.get('/rankings', async (req: Request, res: Response) => {
  try {
    const { error, value } = userRankingQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { page, limit, sortBy, sortOrder, search, minTrust, maxTrust } = value;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { identity: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (minTrust !== undefined || maxTrust !== undefined) {
      where.trust = {};
      if (minTrust !== undefined) where.trust.gte = minTrust;
      if (maxTrust !== undefined) where.trust.lte = maxTrust;
    }

    // Get users with aggregated stats
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        identity: true,
        displayName: true,
        trust: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
            scores: true,
            reactions: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.user.count({ where });

    // Calculate additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get average score for this user
        const avgScoreResult = await prisma.score.aggregate({
          where: { userId: user.id },
          _avg: { value: true }
        });

        // Get recent activity (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const recentMessages = await prisma.message.count({
          where: {
            authorId: user.id,
            createdAt: { gte: weekAgo }
          }
        });

        return {
          ...user,
          avgScore: avgScoreResult._avg.value || 0,
          recentMessages,
          totalMessages: user._count.messages,
          totalScores: user._count.scores,
          totalReactions: user._count.reactions
        };
      })
    );

    res.json({
      ok: true,
      data: usersWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get user rankings error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/users/:id - Get detailed user information
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        messages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            scores: true,
            reactions: true
          }
        },
        _count: {
          select: {
            messages: true,
            scores: true,
            reactions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'User not found'
      });
    }

    // Get additional stats
    const avgScoreResult = await prisma.score.aggregate({
      where: { userId: user.id },
      _avg: { value: true },
      _min: { value: true },
      _max: { value: true }
    });

    // Get score distribution
    const scoreDistribution = await prisma.score.groupBy({
      by: ['kind'],
      where: { userId: user.id },
      _avg: { value: true },
      _count: { value: true }
    });

    // Get recent activity (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    const recentActivity = await prisma.message.count({
      where: {
        authorId: user.id,
        createdAt: { gte: monthAgo }
      }
    });

    res.json({
      ok: true,
      data: {
        ...user,
        stats: {
          avgScore: avgScoreResult._avg.value || 0,
          minScore: avgScoreResult._min.value || 0,
          maxScore: avgScoreResult._max.value || 0,
          recentActivity,
          scoreDistribution
        }
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/users/:id/messages - Get user's messages with scores
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;


    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'User not found'
      });
    }

    const messages = await prisma.message.findMany({
      where: { authorId: id },
      include: {
        scores: {
          orderBy: { createdAt: 'desc' }
        },
        reactions: {
          include: {
            user: {
              select: { id: true, identity: true, displayName: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    const totalCount = await prisma.message.count({
      where: { authorId: id }
    });

    res.json({
      ok: true,
      data: messages,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get user messages error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export { router as userRoutes };
