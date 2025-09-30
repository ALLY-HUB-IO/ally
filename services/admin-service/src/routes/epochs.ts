import { Router, Request, Response } from 'express';
import * as Joi from 'joi';
import { prisma } from '../db/client';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createEpochSchema = Joi.object({
  epochNumber: Joi.number().integer().min(1).required(),
  epochStart: Joi.date().required(),
  epochEnd: Joi.date().greater(Joi.ref('epochStart')).required(),
  claimWindowEnds: Joi.date().greater(Joi.ref('epochEnd')).required(),
  allocated: Joi.string().pattern(/^\d+$/).required(),
  state: Joi.string().valid('OPEN', 'CLAIMING', 'RECYCLED', 'EXPIRED', 'CLOSED').default('OPEN')
});

const updateEpochSchema = Joi.object({
  state: Joi.string().valid('OPEN', 'CLAIMING', 'RECYCLED', 'EXPIRED', 'CLOSED').optional(),
  allocated: Joi.string().pattern(/^\d+$/).optional(),
  claimWindowEnds: Joi.date().optional(),
  claimed: Joi.string().pattern(/^\d+$/).optional(),
  recycledAt: Joi.date().optional()
});

const epochQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('epochNumber', 'epochStart', 'epochEnd', 'createdAt').default('epochNumber'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  state: Joi.string().valid('OPEN', 'CLAIMING', 'RECYCLED', 'EXPIRED', 'CLOSED').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

// GET /api/campaigns/:campaignId/epochs - List epochs for campaign
router.get('/campaigns/:campaignId/epochs', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { error, value } = epochQuerySchema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { page, limit, sortBy, sortOrder, state, startDate, endDate } = value;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = { campaignId };

    if (state) {
      where.state = state;
    }

    if (startDate || endDate) {
      where.epochStart = {};
      if (startDate) where.epochStart.gte = startDate;
      if (endDate) where.epochStart.lte = endDate;
    }

    const epochs = await (prisma as any).campaignEpoch.findMany({
      where,
      include: {
        _count: {
          select: { payouts: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    const totalCount = await (prisma as any).campaignEpoch.count({ where });

    // Calculate additional stats for each epoch
    const epochsWithStats = await Promise.all(
      epochs.map(async (epoch) => {
        // Get payout statistics for this epoch
        const payoutStats = await prisma.payout.aggregate({
          where: { epochId: epoch.id } as any,
          _count: { id: true }
        });

        const completedPayouts = await prisma.payout.count({
          where: { 
            epochId: epoch.id,
            status: 'COMPLETED'
          } as any
        });

        // Get total payout amount for this epoch
        const totalPayoutResult = await prisma.$queryRaw<[{ sum: bigint }]>`
          SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) as sum
          FROM "Payout"
          WHERE "epochId" = ${epoch.id}
        `;
        const totalPayoutAmount = totalPayoutResult[0]?.sum?.toString() || '0';

        return {
          ...epoch,
          stats: {
            totalPayouts: payoutStats._count.id || 0,
            completedPayouts,
            totalPayoutAmount,
            remainingAmount: (BigInt(epoch.allocated) - BigInt(totalPayoutAmount)).toString()
          }
        };
      })
    );

    res.json({
      ok: true,
      data: epochsWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get campaign epochs error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/epochs/:epochId - Get epoch details
router.get('/:epochId', async (req: Request, res: Response) => {
  try {
    const { epochId } = req.params;

    const epoch = await (prisma as any).campaignEpoch.findUnique({
      where: { id: epochId },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            tokenSymbol: true,
            chainId: true
          }
        },
        payouts: {
          include: {
            user: {
              select: { id: true, displayName: true, wallet: true }
            },
            platformUser: {
              select: { id: true, displayName: true, platform: true, platformId: true }
            },
            processedBy: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!epoch) {
      return res.status(404).json({
        ok: false,
        error: 'Epoch not found'
      });
    }

    // Calculate detailed statistics
    const payoutStats = await prisma.payout.aggregate({
      where: { epochId: epoch.id } as any,
      _count: { id: true }
    });

    const statusStats = await prisma.payout.groupBy({
      by: ['status'],
      where: { epochId: epoch.id } as any,
      _count: { id: true }
    });

    // Get total payout amount
    const totalPayoutResult = await prisma.$queryRaw<[{ sum: bigint }]>`
      SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) as sum
      FROM "Payout"
      WHERE "epochId" = ${epoch.id}
    `;
    const totalPayoutAmount = totalPayoutResult[0]?.sum?.toString() || '0';

    res.json({
      ok: true,
      data: {
        ...epoch,
        stats: {
          totalPayouts: payoutStats._count.id || 0,
          totalPayoutAmount,
          remainingAmount: (BigInt(epoch.allocated) - BigInt(totalPayoutAmount)).toString(),
          statusBreakdown: statusStats.reduce((acc, stat) => {
            acc[stat.status] = {
              count: stat._count.id,
              amount: '0' // We'll calculate this separately if needed
            };
            return acc;
          }, {} as Record<string, { count: number; amount: string }>)
        }
      }
    });
  } catch (error) {
    console.error('Get epoch details error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/campaigns/:campaignId/epochs - Create new epoch
router.post('/campaigns/:campaignId/epochs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { error, value } = createEpochSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaign not found'
      });
    }

    // Check if epoch number already exists for this campaign
    const existingEpoch = await (prisma as any).campaignEpoch.findUnique({
      where: {
        campaignId_epochNumber: {
          campaignId,
          epochNumber: value.epochNumber
        }
      }
    });

    if (existingEpoch) {
      return res.status(400).json({
        ok: false,
        error: `Epoch ${value.epochNumber} already exists for this campaign`
      });
    }

    const epoch = await (prisma as any).campaignEpoch.create({
      data: {
        campaignId,
        epochNumber: value.epochNumber,
        epochStart: value.epochStart,
        epochEnd: value.epochEnd,
        claimWindowEnds: value.claimWindowEnds,
        allocated: value.allocated,
        state: value.state
      }
    });

    res.status(201).json({
      ok: true,
      data: epoch,
      message: 'Epoch created successfully'
    });
  } catch (error) {
    console.error('Create epoch error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// PUT /api/epochs/:epochId - Update epoch
router.put('/:epochId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { epochId } = req.params;
    const { error, value } = updateEpochSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    // Check if epoch exists
    const existingEpoch = await (prisma as any).campaignEpoch.findUnique({
      where: { id: epochId }
    });

    if (!existingEpoch) {
      return res.status(404).json({
        ok: false,
        error: 'Epoch not found'
      });
    }

    // Validate state transitions
    const validTransitions: Record<string, string[]> = {
      'OPEN': ['CLAIMING', 'CLOSED'],
      'CLAIMING': ['RECYCLED', 'EXPIRED', 'CLOSED'],
      'RECYCLED': ['CLOSED'],
      'EXPIRED': ['CLOSED'],
      'CLOSED': []
    };

    if (value.state && !validTransitions[existingEpoch.state]?.includes(value.state)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid state transition from ${existingEpoch.state} to ${value.state}`
      });
    }

    const epoch = await (prisma as any).campaignEpoch.update({
      where: { id: epochId },
      data: value
    });

    res.json({
      ok: true,
      data: epoch,
      message: 'Epoch updated successfully'
    });
  } catch (error) {
    console.error('Update epoch error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export { router as epochRoutes };
