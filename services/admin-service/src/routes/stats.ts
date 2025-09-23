import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { prisma } from '../db/client';

const router = Router();

// Validation schemas
const statsQuerySchema = Joi.object({
  period: Joi.string().valid('1d', '7d', '30d', '90d', '1y').default('7d'),
  granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day')
});

// GET /api/stats/overview - Get system overview statistics
router.get('/overview', async (req: Request, res: Response) => {
  try {

    const [
      userStats,
      messageStats,
      interactionStats,
      campaignStats,
      payoutStats
    ] = await Promise.all([
      // User statistics
      prisma.user.aggregate({
        _count: { id: true },
        _avg: { trust: true },
        _min: { trust: true },
        _max: { trust: true }
      }),

      // Message statistics
      prisma.message.aggregate({
        _count: { id: true }
      }),

      // Interaction statistics
      prisma.interactions.aggregate({
        _count: { id: true },
        _avg: { score: true },
        _min: { score: true },
        _max: { score: true }
      }),

      // Campaign statistics
      prisma.campaign.aggregate({
        _count: { id: true }
      }),

      // Payout statistics using raw query
      prisma.$queryRaw<[{ sum: bigint }]>`
        SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) as sum
        FROM "Payout"
      `
    ]);

    // Get recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      recentUsers,
      recentMessages,
      recentInteractions,
      recentPayouts
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: yesterday } }
      }),
      prisma.message.count({
        where: { createdAt: { gte: yesterday } }
      }),
      prisma.interactions.count({
        where: { createdAt: { gte: yesterday } }
      }),
      prisma.payout.count({
        where: { createdAt: { gte: yesterday } }
      })
    ]);

    res.json({
      ok: true,
      data: {
        users: {
          total: userStats._count.id,
          averageTrust: userStats._avg.trust || 0,
          minTrust: userStats._min.trust || 0,
          maxTrust: userStats._max.trust || 0,
          recent: recentUsers
        },
        messages: {
          total: messageStats._count.id,
          recent: recentMessages
        },
        interactions: {
          total: interactionStats._count.id,
          averageScore: interactionStats._avg.score || 0,
          minScore: interactionStats._min.score || 0,
          maxScore: interactionStats._max.score || 0,
          recent: recentInteractions
        },
        campaigns: {
          total: campaignStats._count.id || 0,
          totalRewardPool: '0' // We'll calculate this separately if needed
        },
        payouts: {
          total: 0, // We'll get this from a separate query
          totalAmount: payoutStats[0]?.sum?.toString() || '0',
          recent: recentPayouts
        }
      }
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/stats/activity - Get activity trends
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const { error, value } = statsQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { period, granularity } = value;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get activity data based on granularity
    let dateFormat: string;
    let groupByClause: string;

    switch (granularity) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        groupByClause = "DATE_TRUNC('hour', \"createdAt\")";
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        groupByClause = "DATE_TRUNC('day', \"createdAt\")";
        break;
      case 'week':
        dateFormat = 'YYYY-"W"WW';
        groupByClause = "DATE_TRUNC('week', \"createdAt\")";
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        groupByClause = "DATE_TRUNC('month', \"createdAt\")";
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
        groupByClause = "DATE_TRUNC('day', \"createdAt\")";
    }

    // Get user registrations over time
    const userActivity = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${startDate}
      GROUP BY ${groupByClause}
      ORDER BY period
    `;

    // Get message activity over time
    const messageActivity = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as count
      FROM "Message"
      WHERE "createdAt" >= ${startDate}
      GROUP BY ${groupByClause}
      ORDER BY period
    `;

    // Get interaction activity over time
    const interactionActivity = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as count,
        AVG(score) as avg_score
      FROM "Interactions"
      WHERE "createdAt" >= ${startDate}
      GROUP BY ${groupByClause}
      ORDER BY period
    `;

    res.json({
      ok: true,
      data: {
        period,
        granularity,
        startDate,
        endDate: now,
        activity: {
          users: userActivity,
          messages: messageActivity,
          interactions: interactionActivity
        }
      }
    });
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/stats/score-distribution - Get score distribution analysis
router.get('/score-distribution', async (req: Request, res: Response) => {
  try {

    // Get score distribution buckets
    const scoreDistribution = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN score >= 0.9 THEN 'excellent'
          WHEN score >= 0.8 THEN 'very-good'
          WHEN score >= 0.7 THEN 'good'
          WHEN score >= 0.6 THEN 'above-average'
          WHEN score >= 0.5 THEN 'average'
          WHEN score >= 0.4 THEN 'below-average'
          WHEN score >= 0.3 THEN 'poor'
          WHEN score >= 0.2 THEN 'very-poor'
          ELSE 'extremely-poor'
        END as bucket,
        COUNT(*) as count,
        AVG(score) as avg_score
      FROM "Interactions"
      GROUP BY bucket
      ORDER BY avg_score DESC
    `;

    // Get platform-specific score distributions
    const platformDistribution = await prisma.interactions.groupBy({
      by: ['platform'],
      _count: { id: true },
      _avg: { score: true },
      _min: { score: true },
      _max: { score: true }
    });

    // Get top scoring messages
    const topMessages = await prisma.interactions.findMany({
      orderBy: { score: 'desc' },
      take: 10,
      select: {
        id: true,
        externalId: true,
        content: true,
        score: true,
        platform: true,
        createdAt: true,
        authorId: true
      }
    });

    res.json({
      ok: true,
      data: {
        distribution: scoreDistribution,
        byPlatform: platformDistribution,
        topMessages
      }
    });
  } catch (error) {
    console.error('Get score distribution error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/stats/user-engagement - Get user engagement metrics
router.get('/user-engagement', async (req: Request, res: Response) => {
  try {

    // Get user engagement tiers
    const engagementTiers = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN "trust" >= 0.8 THEN 'highly-engaged'
          WHEN "trust" >= 0.6 THEN 'engaged'
          WHEN "trust" >= 0.4 THEN 'moderately-engaged'
          WHEN "trust" >= 0.2 THEN 'low-engagement'
          ELSE 'inactive'
        END as tier,
        COUNT(*) as user_count,
        AVG("trust") as avg_trust
      FROM "User"
      GROUP BY tier
      ORDER BY avg_trust DESC
    `;

    // Get most active users
    const mostActiveUsers = await prisma.user.findMany({
      orderBy: { trust: 'desc' },
      take: 20,
      select: {
        id: true,
        identity: true,
        displayName: true,
        trust: true,
        createdAt: true,
        _count: {
          select: {
            messages: true,
            scores: true,
            reactions: true
          }
        }
      }
    });

    // Get user activity over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUserActivity = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*) as new_users
      FROM "User"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date
    `;

    res.json({
      ok: true,
      data: {
        engagementTiers,
        mostActiveUsers,
        recentActivity: recentUserActivity
      }
    });
  } catch (error) {
    console.error('Get user engagement error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export { router as statsRoutes };
