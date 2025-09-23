import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { prisma } from '../db/client';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const payoutQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'amount', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED').optional(),
  campaignId: Joi.string().optional(),
  userId: Joi.string().optional(),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional()
});

const processPayoutSchema = Joi.object({
  payoutIds: Joi.array().items(Joi.string()).min(1).required()
});

// GET /api/payouts - Get all payouts with filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = payoutQuerySchema.validate(req.query);
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
      status, 
      campaignId, 
      userId,
      dateFrom,
      dateTo
    } = value;
    
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            tokenSymbol: true,
            tokenAddress: true
          }
        },
        processedBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    const totalCount = await prisma.payout.count({ where });

    res.json({
      ok: true,
      data: payouts,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/payouts/:id - Get payout details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const payout = await prisma.payout.findUnique({
      where: { id },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            description: true,
            tokenSymbol: true,
            tokenAddress: true,
            totalRewardPool: true,
            startDate: true,
            endDate: true,
            isActive: true
          }
        },
        processedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!payout) {
      return res.status(404).json({
        ok: false,
        error: 'Payout not found'
      });
    }

    res.json({
      ok: true,
      data: payout
    });
  } catch (error) {
    console.error('Get payout details error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/payouts/process - Process multiple payouts
router.post('/process', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = processPayoutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { payoutIds } = value;
    const adminId = req.admin!.id;

    // Get payouts that are pending
    const payouts = await prisma.payout.findMany({
      where: {
        id: { in: payoutIds },
        status: 'PENDING'
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            tokenSymbol: true,
            tokenAddress: true,
            isActive: true
          }
        }
      }
    });

    if (payouts.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No pending payouts found'
      });
    }

    // Update payouts to processing status
    await prisma.payout.updateMany({
      where: {
        id: { in: payoutIds },
        status: 'PENDING'
      },
      data: {
        status: 'PROCESSING',
        processedById: adminId
      }
    });

    // TODO: Integrate with shade-agent service for actual blockchain transactions
    // For now, we'll simulate the processing
    const results = await Promise.allSettled(
      payouts.map(async (payout) => {
        try {
          // Simulate blockchain transaction
          // In real implementation, this would call the shade-agent service
          const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
          
          // Update payout as completed
          const updatedPayout = await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: 'COMPLETED',
              txHash: mockTxHash,
              processedById: adminId
            }
          });

          return {
            payoutId: payout.id,
            status: 'success',
            txHash: mockTxHash,
            payout: updatedPayout
          };
        } catch (error) {
          // Update payout as failed
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              processedById: adminId
            }
          });

          return {
            payoutId: payout.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success');
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error'));

    res.json({
      ok: true,
      message: `Processed ${payouts.length} payouts`,
      results: {
        successful: successful.length,
        failed: failed.length,
        details: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'error', error: r.reason })
      }
    });
  } catch (error) {
    console.error('Process payouts error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/payouts/:id/cancel - Cancel a payout
router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.admin!.id;

    const payout = await prisma.payout.findUnique({
      where: { id }
    });

    if (!payout) {
      return res.status(404).json({
        ok: false,
        error: 'Payout not found'
      });
    }

    if (payout.status !== 'PENDING') {
      return res.status(400).json({
        ok: false,
        error: 'Only pending payouts can be cancelled'
      });
    }

    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        processedById: adminId
      }
    });

    res.json({
      ok: true,
      data: updatedPayout,
      message: 'Payout cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel payout error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/payouts/stats/summary - Get payout statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {

    const [
      totalPayouts,
      statusStats,
      totalAmount,
      recentActivity
    ] = await Promise.all([
      // Total payouts
      prisma.payout.count(),
      
      // Status breakdown
      prisma.payout.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      
      // Total amount paid out using raw query
      prisma.$queryRaw<[{ sum: bigint }]>`
        SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) as sum
        FROM "Payout"
        WHERE status = 'COMPLETED'
      `,
      
      // Recent activity (last 7 days)
      prisma.payout.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const totalAmountPaid = totalAmount[0]?.sum?.toString() || '0';

    res.json({
      ok: true,
      data: {
        totalPayouts,
        totalAmountPaid,
        recentActivity,
        statusBreakdown: statusStats.reduce((acc, stat) => {
          acc[stat.status] = {
            count: stat._count.id,
            amount: '0' // We'll calculate this separately if needed
          };
          return acc;
        }, {} as Record<string, { count: number; amount: string }>)
      }
    });
  } catch (error) {
    console.error('Get payout stats error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export { router as payoutRoutes };
