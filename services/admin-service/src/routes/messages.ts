import { Router, Request, Response } from 'express';
import * as Joi from 'joi';
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

// GET /api/messages - Get messages with filtering and live feed capability
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

    // Build where clause for messages
    const where: any = {};
    
    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    if (platform) {
      where.source = {
        platform: platform
      };
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

    // For score sorting, we need to fetch more messages to calculate scores and then sort
    const fetchLimit = sortBy === 'score' ? Math.max(limit * 3, 100) : limit;
    const fetchOffset = sortBy === 'score' ? 0 : offset;

    // Get messages with their scores and reactions
    const messages = await prisma.message.findMany({
      where,
      include: {
        author: {
          select: { 
            id: true, 
            displayName: true, 
            platform: true,
            user: {
              select: { id: true, wallet: true, trust: true }
            }
          }
        },
        source: {
          select: { platform: true, name: true }
        },
        scores: {
          orderBy: { createdAt: 'desc' },
          include: {
            platformUser: {
              select: {
                id: true,
                displayName: true,
                platform: true,
                user: {
                  select: {
                    id: true,
                    wallet: true,
                    trust: true
                  }
                }
              }
            }
          }
        },
        reactions: {
          include: {
            platformUser: {
              select: { id: true, displayName: true, platform: true }
            }
          }
        }
      },
      orderBy: sortBy === 'score' ? { createdAt: 'desc' } : { [sortBy]: sortOrder },
      skip: fetchOffset,
      take: fetchLimit
    });

    // Get total count for pagination
    const totalCount = await prisma.message.count({ where });

    // Calculate score breakdown and average score for each message
    const enrichedMessages = messages.map(message => {
      const scoreBreakdown = message.scores.reduce((acc, score) => {
        acc[score.kind] = score.value;
        return acc;
      }, {} as Record<string, number>);

      const avgScore = message.scores.length > 0 
        ? message.scores.reduce((sum, score) => sum + score.value, 0) / message.scores.length 
        : 0;

      return {
        ...message,
        score: avgScore,
        scoreBreakdown,
        rationale: `Average score based on ${message.scores.length} scoring factors`,
        platform: message.source?.platform || 'unknown'
      };
    });

    // Sort by score if requested (after enrichment)
    if (sortBy === 'score') {
      enrichedMessages.sort((a, b) => {
        return sortOrder === 'asc' ? a.score - b.score : b.score - a.score;
      });
    }

    // Filter by score range if specified
    const filteredMessages = enrichedMessages.filter(message => {
      if (minScore !== undefined && message.score < minScore) return false;
      if (maxScore !== undefined && message.score > maxScore) return false;
      return true;
    });

    // Apply pagination after sorting and filtering (for score sorting)
    const paginatedMessages = sortBy === 'score' 
      ? filteredMessages.slice(offset, offset + limit)
      : filteredMessages;

    res.json({
      ok: true,
      data: paginatedMessages,
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

// GET /api/messages/live-feed - Get recent messages for live feed
router.get('/live-feed', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 5 * 60 * 1000); // Default: last 5 minutes

    const messages = await prisma.message.findMany({
      where: {
        createdAt: { gte: since }
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            platform: true,
            user: {
              select: { id: true, wallet: true, trust: true }
            }
          }
        },
        source: {
          select: { platform: true, name: true }
        },
        scores: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Limit scores for performance
          include: {
            platformUser: {
              select: {
                id: true,
                displayName: true,
                platform: true,
                user: {
                  select: {
                    id: true,
                    wallet: true,
                    trust: true
                  }
                }
              }
            }
          }
        },
        reactions: {
          include: {
            platformUser: {
              select: { id: true, displayName: true, platform: true }
            }
          },
          take: 10 // Limit reactions for performance
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    const enrichedMessages = messages.map(message => {
      const scoreBreakdown = message.scores.reduce((acc, score) => {
        acc[score.kind] = score.value;
        return acc;
      }, {} as Record<string, number>);

      const avgScore = message.scores.length > 0
        ? message.scores.reduce((sum, score) => sum + score.value, 0) / message.scores.length
        : null;

      return {
        ...message,
        score: avgScore,
        scoreBreakdown,
        rationale: message.scores.length > 0 
          ? `Average score based on ${message.scores.length} scoring factors`
          : 'Message is being analyzed for sentiment',
        platform: message.source?.platform || 'unknown'
      };
    });

    res.json({
      ok: true,
      data: enrichedMessages,
      meta: {
        since: since.toISOString(),
        count: enrichedMessages.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get live feed error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/messages/critical - Get critical messages (lowest rated in last 24h)
router.get('/critical', async (req: Request, res: Response) => {
  try {
    // Get messages from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Fetch messages from last 24h with their scores
    const messages = await prisma.message.findMany({
      where: {
        createdAt: { gte: yesterday },
        isDeleted: false
      },
      include: {
        author: {
          select: { 
            id: true, 
            displayName: true, 
            platform: true,
            user: {
              select: { id: true, wallet: true, trust: true }
            }
          }
        },
        source: {
          select: { platform: true, name: true }
        },
        scores: {
          orderBy: { createdAt: 'desc' },
          include: {
            platformUser: {
              select: {
                id: true,
                displayName: true,
                platform: true,
                user: {
                  select: {
                    id: true,
                    wallet: true,
                    trust: true
                  }
                }
              }
            }
          }
        },
        discordDetails: true
      },
      orderBy: { createdAt: 'desc' },
      take: 500 // Fetch more messages to ensure we get enough with low scores
    });

    // Use only the latest score for each message
    const messagesWithLatestScores = messages.map(message => {
      // Get the latest score (first in the array since they're ordered by createdAt desc)
      const latestScore = message.scores.length > 0 ? message.scores[0] : null;
      
      if (latestScore && latestScore.value < 0.4) {
        return {
          ...message,
          score: latestScore.value,
          platform: message.source?.platform || 'unknown',
          scoreId: latestScore.id,
          scoreCreatedAt: latestScore.createdAt
        };
      }
      return null;
    }).filter(Boolean); // Remove null entries

    console.log(`Critical endpoint: Messages with critical latest scores: ${messagesWithLatestScores.length}`);

    console.log(`Critical endpoint: Found ${messages.length} messages from last 24h`);
    console.log(`Critical endpoint: Messages with multiple scores: ${messages.filter(m => m.scores.length > 1).length}`);
    
    // Use messages with latest critical scores
    const criticalMessages = messagesWithLatestScores
      .sort((a, b) => a.score - b.score) // Sort by lowest score first
      .slice(0, 5); // Take only top 5 critical messages

    console.log(`Critical endpoint: Critical messages found: ${criticalMessages.length}`);
    if (criticalMessages.length > 0) {
      console.log(`Critical endpoint: Score range: ${criticalMessages[0].score} to ${criticalMessages[criticalMessages.length - 1].score}`);
    }

    res.json({
      ok: true,
      data: criticalMessages,
      count: criticalMessages.length
    });
  } catch (error) {
    console.error('Get critical messages error:', error);
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

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        author: {
          select: { 
            id: true, 
            displayName: true, 
            platform: true,
            user: {
              select: { id: true, wallet: true, trust: true }
            }
          }
        },
        source: {
          select: { platform: true, name: true }
        },
        scores: {
          orderBy: { createdAt: 'desc' },
          include: {
            platformUser: {
              select: {
                id: true,
                displayName: true,
                platform: true,
                user: {
                  select: {
                    id: true,
                    wallet: true,
                    trust: true
                  }
                }
              }
            }
          }
        },
        reactions: {
          include: {
            platformUser: {
              select: { id: true, displayName: true, platform: true }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({
        ok: false,
        error: 'Message not found'
      });
    }

    // Calculate score breakdown and average score
    const scoreBreakdown = message.scores.reduce((acc, score) => {
      acc[score.kind] = score.value;
      return acc;
    }, {} as Record<string, number>);

    const avgScore = message.scores.length > 0 
      ? message.scores.reduce((sum, score) => sum + score.value, 0) / message.scores.length 
      : 0;

    const result = {
      ...message,
      score: avgScore,
      scoreBreakdown,
      rationale: `Average score based on ${message.scores.length} scoring factors`,
      platform: message.source?.platform || 'unknown'
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
      totalScores,
      avgScore,
      scoreDistribution,
      platformStats,
      recentActivity
    ] = await Promise.all([
      // Total messages
      prisma.message.count(),
      
      // Total scores
      prisma.score.count(),
      
      // Average score
      prisma.score.aggregate({
        _avg: { value: true },
        _min: { value: true },
        _max: { value: true }
      }),
      
      // Score distribution (buckets)
      prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN value >= 0.8 THEN 'high'
            WHEN value >= 0.6 THEN 'medium-high'
            WHEN value >= 0.4 THEN 'medium'
            WHEN value >= 0.2 THEN 'medium-low'
            ELSE 'low'
          END as bucket,
          COUNT(*) as count
        FROM "Score"
        GROUP BY bucket
        ORDER BY bucket
      `,
      
      // Platform statistics - get from source table
      prisma.source.groupBy({
        by: ['platform'],
        _count: { id: true }
      }),
      
      // Recent activity (last 7 days)
      prisma.message.count({
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
        totalScores,
        averageScore: avgScore._avg.value || 0,
        minScore: avgScore._min.value || 0,
        maxScore: avgScore._max.value || 0,
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
