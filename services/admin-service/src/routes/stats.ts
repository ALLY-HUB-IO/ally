import { Router, Request, Response } from 'express';
import * as Joi from 'joi';
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
      scoreStats,
      campaignStats,
      payoutStats
    ] = await Promise.all([
      // User statistics
      prisma.user.aggregate({
        _count: { id: true },
        _avg: { trust: true },
        _min: { trust: true },
        _max: { trust: true }
      }).catch(() => ({ _count: { id: 0 }, _avg: { trust: 0 }, _min: { trust: 0 }, _max: { trust: 0 } })),

      // Message statistics (only non-deleted messages)
      prisma.message.aggregate({
        _count: { id: true },
        where: { isDeleted: false }
      }).catch(() => ({ _count: { id: 0 } })),

      // Score statistics (from the Score table)
      prisma.score.aggregate({
        _count: { id: true },
        _avg: { value: true },
        _min: { value: true },
        _max: { value: true }
      }).catch(() => ({ _count: { id: 0 }, _avg: { value: 0 }, _min: { value: 0 }, _max: { value: 0 } })),

      // Campaign statistics
      prisma.campaign.aggregate({
        _count: { id: true }
      }).catch(() => ({ _count: { id: 0 } })),

      // Payout statistics using raw query
      prisma.$queryRaw<[{ sum: bigint }]>`
        SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) as sum
        FROM "Payout"
      `.catch(() => [{ sum: BigInt(0) }])
    ]);

    // Get recent activity (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      recentUsers,
      recentMessages,
      recentScores,
      recentPayouts
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: yesterday } }
      }).catch(() => 0),
      prisma.message.count({
        where: { 
          createdAt: { gte: yesterday },
          isDeleted: false
        }
      }).catch(() => 0),
      prisma.score.count({
        where: { createdAt: { gte: yesterday } }
      }).catch(() => 0),
      prisma.payout.count({
        where: { createdAt: { gte: yesterday } }
      }).catch(() => 0)
    ]);

    // Get total payout count
    const totalPayoutCount = await prisma.payout.count().catch(() => 0);

    // Calculate total reward pool from campaigns
    const totalRewardPoolResult = await prisma.$queryRaw<[{ sum: bigint }]>`
      SELECT COALESCE(SUM(CAST("totalRewardPool" AS BIGINT)), 0) as sum
      FROM "Campaign"
    `.catch(() => [{ sum: BigInt(0) }]);

    // Get this month's marketing budget (active campaigns for current month)
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    const thisMonthBudget = await prisma.$queryRaw<[{ sum: bigint }]>`
      SELECT COALESCE(SUM(CAST("totalRewardPool" AS BIGINT)), 0) as sum
      FROM "Campaign"
      WHERE "isActive" = true
        AND "startDate" <= ${endOfMonth}
        AND "endDate" >= ${startOfMonth}
    `.catch(() => [{ sum: BigInt(0) }]);

    // Get top platform by message count (only non-deleted messages)
    const topPlatformResult = await prisma.$queryRaw<[{ platform: string; count: bigint }]>`
      SELECT s.platform, COUNT(*) as count
      FROM "Message" m
      JOIN "Source" s ON m."sourceId" = s.id
      WHERE m."isDeleted" = false
      GROUP BY s.platform
      ORDER BY count DESC
      LIMIT 1
    `.catch(() => [{ platform: 'none', count: BigInt(0) }]);

    // Get total interactions (messages + reactions)
    const totalReactions = await prisma.reaction.count().catch(() => 0);
    const totalInteractions = messageStats._count.id + totalReactions;

    // Get 24h sentiment analysis (latest score per message from last 24h)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Get messages from last 24h with their latest scores (only non-deleted messages)
    const messages24h = await prisma.message.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        isDeleted: false
      },
      include: {
        scores: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get only the latest score per message
        }
      }
    }).catch(() => []);

    // Calculate sentiment percentages using same labels as Discord processor
    const messagesWithScores = messages24h.filter(msg => msg.scores.length > 0);
    const total24hScores = messagesWithScores.length;
    let veryNegativeCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let positiveCount = 0;
    let veryPositiveCount = 0;
    let totalScore = 0;

    if (total24hScores > 0) {
      messagesWithScores.forEach(message => {
        const latestScore = message.scores[0].value;
        totalScore += latestScore;
        
        if (latestScore <= 0.2) {
          veryNegativeCount++;
        } else if (latestScore <= 0.4) {
          negativeCount++;
        } else if (latestScore <= 0.6) {
          neutralCount++;
        } else if (latestScore <= 0.8) {
          positiveCount++;
        } else {
          veryPositiveCount++;
        }
      });
    }

    // Calculate average sentiment
    const averageSentiment = total24hScores > 0 ? totalScore / total24hScores : 0;

    const sentiment24hData = {
      total: total24hScores,
      average: averageSentiment,
      // Combine very negative + negative, and very positive + positive for 3-category display
      negative: total24hScores > 0 ? Math.round(((veryNegativeCount + negativeCount) / total24hScores) * 100) : 0,
      neutral: total24hScores > 0 ? Math.round((neutralCount / total24hScores) * 100) : 0,
      positive: total24hScores > 0 ? Math.round(((positiveCount + veryPositiveCount) / total24hScores) * 100) : 0
    };

    res.json({
      ok: true,
      data: {
        // Dashboard-specific metrics
        thisMonthBudget: thisMonthBudget[0]?.sum?.toString() || '0',
        topPlatform: topPlatformResult[0]?.platform || 'none',
        totalInteractions,
        sentiment24h: sentiment24hData,
        
        // Original metrics (keeping for backward compatibility)
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
          total: scoreStats._count.id,
          averageScore: scoreStats._avg.value || 0,
          minScore: scoreStats._min.value || 0,
          maxScore: scoreStats._max.value || 0,
          recent: recentScores
        },
        campaigns: {
          total: campaignStats._count.id || 0,
          totalRewardPool: totalRewardPoolResult[0]?.sum?.toString() || '0'
        },
        payouts: {
          total: totalPayoutCount,
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

    // Get message activity over time (only non-deleted messages)
    const messageActivity = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as count
      FROM "Message"
      WHERE "createdAt" >= ${startDate}
        AND "isDeleted" = false
      GROUP BY ${groupByClause}
      ORDER BY period
    `;

    // Get score activity over time
    const scoreActivity = await prisma.$queryRaw`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as count,
        AVG(value) as avg_score
      FROM "Score"
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
          interactions: scoreActivity
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

    // Get score distribution buckets (only from non-deleted messages)
    const scoreDistribution = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN s.value >= 0.9 THEN 'excellent'
          WHEN s.value >= 0.8 THEN 'very-good'
          WHEN s.value >= 0.7 THEN 'good'
          WHEN s.value >= 0.6 THEN 'above-average'
          WHEN s.value >= 0.5 THEN 'average'
          WHEN s.value >= 0.4 THEN 'below-average'
          WHEN s.value >= 0.3 THEN 'poor'
          WHEN s.value >= 0.2 THEN 'very-poor'
          ELSE 'extremely-poor'
        END as bucket,
        COUNT(*) as count,
        AVG(s.value) as avg_score
      FROM "Score" s
      JOIN "Message" m ON s."messageId" = m.id
      WHERE m."isDeleted" = false
      GROUP BY bucket
      ORDER BY avg_score DESC
    `;

    // Get score kind distribution (only from non-deleted messages)
    const kindDistribution = await prisma.score.groupBy({
      by: ['kind'],
      _count: { id: true },
      _avg: { value: true },
      _min: { value: true },
      _max: { value: true },
      where: {
        message: {
          isDeleted: false
        }
      }
    });

    // Get top scoring messages with their details (only from non-deleted messages)
    const topScores = await prisma.score.findMany({
      orderBy: { value: 'desc' },
      take: 10,
      where: {
        message: {
          isDeleted: false
        }
      },
      include: {
        message: {
          select: {
            id: true,
            externalId: true,
            content: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                displayName: true,
                platform: true
              }
            }
          }
        }
      }
    });

    res.json({
      ok: true,
      data: {
        distribution: scoreDistribution,
        byKind: kindDistribution,
        topScores
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
        wallet: true,
        displayName: true,
        trust: true,
        createdAt: true,
        _count: {
          select: {
            platformUsers: true,
            payouts: true
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

// GET /api/stats/leaderboard - Get top influential users
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    // Get total interactions count for percentage calculation (only non-deleted messages)
    const totalInteractions = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT 
        (SELECT COUNT(*) FROM "Message" WHERE "isDeleted" = false) + 
        (SELECT COUNT(*) FROM "Reaction") as count
    `.catch(() => [{ count: BigInt(0) }]);

    const totalInteractionsCount = Number(totalInteractions[0]?.count || 0);

    // Get top 10 most active users with their platform activity and average sentiment
    // Include users from User table AND platform users that aren't already in users
    const leaderboard = await prisma.$queryRaw<Array<{
      userId: string;
      wallet: string | null;
      displayName: string | null;
      platform: string;
      platformDisplayName: string | null;
      totalInteractions: number;
      averageSentiment: number | null;
    }>>`
      SELECT 
        COALESCE(pu."userId", pu.id) as "userId",
        u.wallet,
        u."displayName" as "displayName",
        pu.platform,
        pu."displayName" as "platformDisplayName",
        CAST((
          (SELECT COUNT(*) FROM "Message" m WHERE m."authorId" = pu.id AND m."isDeleted" = false) +
          (SELECT COUNT(*) FROM "Reaction" r WHERE r."platformUserId" = pu.id)
        ) AS INTEGER) as "totalInteractions",
        CAST((
          SELECT AVG(s.value)
          FROM "Message" m
          JOIN "Score" s ON m.id = s."messageId"
          WHERE m."authorId" = pu.id 
            AND m."isDeleted" = false
            AND s."createdAt" = (
              SELECT MAX(s2."createdAt")
              FROM "Score" s2
              WHERE s2."messageId" = m.id
            )
        ) AS DECIMAL(10,4)) as "averageSentiment"
      FROM "PlatformUser" pu
      LEFT JOIN "User" u ON pu."userId" = u.id
      WHERE (
        (SELECT COUNT(*) FROM "Message" m WHERE m."authorId" = pu.id AND m."isDeleted" = false) +
        (SELECT COUNT(*) FROM "Reaction" r WHERE r."platformUserId" = pu.id)
      ) > 0
      ORDER BY "totalInteractions" DESC
      LIMIT 10
    `.catch(() => []);

    // Format the response
    const formattedLeaderboard = leaderboard.map((user: any, index) => {
      // Access fields using the correct camelCase names
      const userInteractions = user.totalInteractions || 0;
      const percentage = totalInteractionsCount > 0 && userInteractions > 0
        ? Math.round((userInteractions / totalInteractionsCount) * 100 * 100) / 100 // Round to 2 decimal places
        : 0;

      // Calculate average sentiment (round to 3 decimal places)
      const averageSentiment = user.averageSentiment ? 
        Math.round(Number(user.averageSentiment) * 1000) / 1000 : null;

      // Determine the best display name
      let userName = 'Unknown';
      if (user.platformDisplayName) {
        userName = user.platformDisplayName;
      } else if (user.displayName) {
        userName = user.displayName;
      } else if (user.wallet) {
        userName = user.wallet;
      }

      return {
        rank: index + 1,
        userId: user.userId,
        userName: userName,
        platform: user.platform,
        interactions: userInteractions,
        points: null, // Not needed right now
        percentageOfTotal: percentage,
        averageSentiment: averageSentiment
      };
    });

    res.json({
      ok: true,
      data: {
        leaderboard: formattedLeaderboard,
        totalInteractions: totalInteractionsCount,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export { router as statsRoutes };
