import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { prisma } from '../db/client';

const router = Router();

// Validation schemas
const messageQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'score', 'content').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().optional(),
  minScore: Joi.number().min(0).max(1).optional(),
  maxScore: Joi.number().min(0).max(1).optional(),
  platform: Joi.string().optional(),
  projectId: Joi.string().optional(),
  authorId: Joi.string().optional(),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional()
});

// GET /api/messages - Get scored messages with filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = messageQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { 
      page, 
      limit, 
      sortBy, 
      sortOrder, 
      search, 
      minScore, 
      maxScore, 
      platform, 
      projectId, 
      authorId,
      dateFrom,
      dateTo
    } = value;
    
    const offset = (page - 1) * limit;

    // Build where clause for interactions
    const where: any = {};
    
    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    if (minScore !== undefined || maxScore !== undefined) {
      where.score = {};
      if (minScore !== undefined) where.score.gte = minScore;
      if (maxScore !== undefined) where.score.lte = maxScore;
    }

    if (platform) {
      where.platform = platform;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    // Get interactions (scored messages)
    const interactions = await prisma.interactions.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.interactions.count({ where });

    // Get additional message details from the Message table for interactions that have external IDs
    const enrichedInteractions = await Promise.all(
      interactions.map(async (interaction) => {
        // Try to find the corresponding message in the Message table
        const message = await prisma.message.findUnique({
          where: { externalId: interaction.externalId },
          include: {
            author: {
              select: { id: true, identity: true, displayName: true, trust: true }
            },
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
          }
        });

        return {
          ...interaction,
          message,
          // Calculate score breakdown if available
          scoreBreakdown: message?.scores.reduce((acc, score) => {
            acc[score.kind] = score.value;
            return acc;
          }, {} as Record<string, number>) || {}
        };
      })
    );

    res.json({
      ok: true,
      data: enrichedInteractions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/messages/:id - Get detailed message information
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try to find in both Interactions and Message tables
    const [interaction, message] = await Promise.all([
      prisma.interactions.findFirst({
        where: { externalId: id }
      }),
      prisma.message.findUnique({
        where: { id },
        include: {
          author: {
            select: { id: true, identity: true, displayName: true, trust: true }
          },
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
        }
      })
    ]);

    if (!interaction && !message) {
      return res.status(404).json({
        ok: false,
        error: 'Message not found'
      });
    }

    // Combine data from both sources
    const result = {
      id: message?.id || interaction?.id,
      externalId: message?.externalId || interaction?.externalId,
      content: message?.content || interaction?.content,
      author: message?.author || null,
      platform: interaction?.platform || 'unknown',
      projectId: interaction?.projectId || 'unknown',
      score: interaction?.score || 0,
      rationale: interaction?.rationale || '',
      createdAt: message?.createdAt || interaction?.createdAt,
      updatedAt: message?.updatedAt || interaction?.editedAt,
      scores: message?.scores || [],
      reactions: message?.reactions || []
    };

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Get message details error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/messages/stats/summary - Get message statistics summary
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {

    // Get basic stats
    const [
      totalMessages,
      totalInteractions,
      avgScore,
      scoreDistribution,
      platformStats,
      recentActivity
    ] = await Promise.all([
      // Total messages
      prisma.message.count(),
      
      // Total interactions
      prisma.interactions.count(),
      
      // Average score
      prisma.interactions.aggregate({
        _avg: { score: true },
        _min: { score: true },
        _max: { score: true }
      }),
      
      // Score distribution (buckets)
      prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN score >= 0.8 THEN 'high'
            WHEN score >= 0.6 THEN 'medium-high'
            WHEN score >= 0.4 THEN 'medium'
            WHEN score >= 0.2 THEN 'medium-low'
            ELSE 'low'
          END as bucket,
          COUNT(*) as count
        FROM "Interactions"
        GROUP BY bucket
        ORDER BY bucket
      `,
      
      // Platform statistics
      prisma.interactions.groupBy({
        by: ['platform'],
        _count: { id: true },
        _avg: { score: true }
      }),
      
      // Recent activity (last 7 days)
      prisma.interactions.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      ok: true,
      data: {
        totalMessages,
        totalInteractions,
        averageScore: avgScore._avg.score || 0,
        minScore: avgScore._min.score || 0,
        maxScore: avgScore._max.score || 0,
        scoreDistribution,
        platformStats,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Get message stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export { router as messageRoutes };
