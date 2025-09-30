import { Router, Request, Response } from 'express';
import * as Joi from 'joi';
import { prisma } from '../db/client';
import { AuthenticatedRequest } from '../middleware/auth';
import { configService } from '@ally/config';

const router = Router();

// Get supported chains and platforms from centralized config
const SUPPORTED_CHAINS = configService.getSupportedChainIds();
const SUPPORTED_PLATFORMS = configService.getSupportedPlatformIds();

// Validation schemas
const createCampaignSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  tokenSymbol: Joi.string().min(2).max(10).required(),
  isNative: Joi.boolean().default(false),
  chainId: Joi.string().valid(...SUPPORTED_CHAINS).required(),
  tokenAddress: Joi.string().when('isNative', {
    is: false,
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  totalRewardPool: Joi.string().pattern(/^\d+$/).required(),
  startDate: Joi.date().optional(), // Now optional - set after funding
  endDate: Joi.date().optional(), // Now optional - set after funding
  isActive: Joi.boolean().default(true),
  maxRewardsPerUser: Joi.string().pattern(/^\d+$/).optional(),
  payoutIntervalSeconds: Joi.number().integer().min(1).required(), // Replaces timeframe
  epochRewardCap: Joi.string().pattern(/^\d+$/).required(),
  claimWindowSeconds: Joi.number().integer().min(1).required(),
  recycleUnclaimed: Joi.boolean().default(true),
  platforms: Joi.array().items(Joi.string().valid(...SUPPORTED_PLATFORMS)).min(1).required()
});

const updateCampaignSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  tokenSymbol: Joi.string().min(2).max(10).optional(),
  isNative: Joi.boolean().optional(),
  chainId: Joi.string().valid(...SUPPORTED_CHAINS).optional(),
  tokenAddress: Joi.string().optional(),
  totalRewardPool: Joi.string().pattern(/^\d+$/).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  isActive: Joi.boolean().optional(),
  maxRewardsPerUser: Joi.string().pattern(/^\d+$/).optional(),
  payoutIntervalSeconds: Joi.number().integer().min(1).optional(),
  epochRewardCap: Joi.string().pattern(/^\d+$/).optional(),
  claimWindowSeconds: Joi.number().integer().min(1).optional(),
  recycleUnclaimed: Joi.boolean().optional(),
  platforms: Joi.array().items(Joi.string().valid(...SUPPORTED_PLATFORMS)).min(1).optional()
}).custom((value, helpers) => {
  // Custom validation for conditional tokenAddress requirement
  if (value.isNative === false && !value.tokenAddress) {
    return helpers.error('any.custom', { message: 'tokenAddress is required when isNative is false' });
  }
  return value;
});

// New validation schemas for epoch-based features
const fundCampaignSchema = Joi.object({
  vaultAddress: Joi.string().required(),
  fundingTxHash: Joi.string().required(),
  startDate: Joi.date().optional()
});

const campaignStatusSchema = Joi.object({
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED').required()
});

const campaignQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'startDate', 'endDate', 'name', 'chainId', 'payoutIntervalSeconds').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  isActive: Joi.boolean().optional(),
  isNative: Joi.boolean().optional(),
  isFunded: Joi.boolean().optional(),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED').optional(),
  chainId: Joi.string().valid(...SUPPORTED_CHAINS).optional(),
  platforms: Joi.string().optional(), // Comma-separated list of platforms
  search: Joi.string().optional()
});

// GET /api/campaigns/supported - Get supported chains and platforms
router.get('/supported', async (req: Request, res: Response) => {
  try {
    const blockchains = configService.getBlockchainsForFrontend();
    const platforms = configService.getPlatformsForFrontend();

    res.json({
      ok: true,
      data: {
        blockchains,
        platforms
      }
    });
  } catch (error) {
    console.error('Get supported config error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/campaigns - Get all campaigns
router.get('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = campaignQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { page, limit, sortBy, sortOrder, isActive, isNative, isFunded, status, chainId, platforms, search } = value;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isNative !== undefined) {
      where.isNative = isNative;
    }

    if (isFunded !== undefined) {
      where.isFunded = isFunded;
    }

    if (status) {
      where.status = status;
    }

    if (chainId) {
      where.chainId = chainId;
    }

    if (platforms) {
      const platformArray = platforms.split(',').map(p => p.trim());
      where.platforms = {
        hasSome: platformArray
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tokenSymbol: { contains: search, mode: 'insensitive' } },
        { chainId: { contains: search, mode: 'insensitive' } },
        { tokenAddress: { contains: search, mode: 'insensitive' } }
      ];
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { payouts: true, epochs: true } as any
        },
        epochs: {
          select: {
            id: true,
            epochNumber: true,
            state: true,
            allocated: true,
            claimed: true,
            epochStart: true,
            epochEnd: true
          },
          orderBy: { epochNumber: 'desc' },
          take: 3 // Get latest 3 epochs for summary
        } as any
      } as any,
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    const totalCount = await prisma.campaign.count({ where });

    // Calculate additional stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        // Get payout statistics
        const payoutStats = await prisma.payout.aggregate({
          where: { campaignId: campaign.id },
          _count: { id: true }
        });

        // Get completed payouts count
        const completedPayouts = await prisma.payout.count({
          where: { 
            campaignId: campaign.id,
            status: 'COMPLETED'
          }
        });

        // Get total payout amount using raw query
        const totalPayoutResult = await prisma.$queryRaw<[{ sum: bigint }]>`
          SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) as sum
          FROM "Payout"
          WHERE "campaignId" = ${campaign.id}
        `;
        const totalPayoutAmount = totalPayoutResult[0]?.sum?.toString() || '0';

        return {
          ...campaign,
          stats: {
            totalPayouts: payoutStats._count.id || 0,
            completedPayouts,
            totalPayoutAmount,
            remainingAmount: (BigInt(campaign.totalRewardPool.toString()) - BigInt(totalPayoutAmount)).toString()
          }
        };
      })
    );

    res.json({
      ok: true,
      data: campaignsWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/campaigns/:id - Get campaign details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        payouts: {
          include: {
            processedBy: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        epochs: {
          include: {
            _count: {
              select: { payouts: true }
            }
          },
          orderBy: { epochNumber: 'asc' }
        } as any
      } as any
    });

    if (!campaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaign not found'
      });
    }

    // Calculate detailed statistics
    const payoutStats = await prisma.payout.aggregate({
      where: { campaignId: campaign.id },
      _count: { id: true }
    });

    const statusStats = await prisma.payout.groupBy({
      by: ['status'],
      where: { campaignId: campaign.id },
      _count: { id: true }
    });

    // Get total payout amount using raw query
    const totalPayoutResult = await prisma.$queryRaw<[{ sum: bigint }]>`
      SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) as sum
      FROM "Payout"
      WHERE "campaignId" = ${campaign.id}
    `;
    const totalPayoutAmount = totalPayoutResult[0]?.sum?.toString() || '0';

    res.json({
      ok: true,
      data: {
        ...campaign,
        stats: {
          totalPayouts: payoutStats._count.id || 0,
          totalPayoutAmount,
          remainingAmount: (BigInt(campaign.totalRewardPool.toString()) - BigInt(totalPayoutAmount)).toString(),
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
    console.error('Get campaign details error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/campaigns - Create new campaign
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error, value } = createCampaignSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const adminId = req.admin!.id;

    const campaign = await prisma.campaign.create({
      data: {
        ...value,
        createdById: adminId
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json({
      ok: true,
      data: campaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// PUT /api/campaigns/:id - Update campaign
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = updateCampaignSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }


    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaign not found'
      });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: value,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      ok: true,
      data: campaign,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /api/campaigns/:id - Delete campaign (soft delete by setting inactive)
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaign not found'
      });
    }

    // Check if there are any payouts
    const payoutCount = await prisma.payout.count({
      where: { campaignId: id }
    });

    if (payoutCount > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Cannot delete campaign with existing payouts. Deactivate instead.'
      });
    }

    await prisma.campaign.delete({
      where: { id }
    });

    res.json({
      ok: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/campaigns/:id/activate - Activate campaign
router.post('/:id/activate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { isActive: true },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      ok: true,
      data: campaign,
      message: 'Campaign activated successfully'
    });
  } catch (error) {
    console.error('Activate campaign error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/campaigns/:id/deactivate - Deactivate campaign
router.post('/:id/deactivate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { isActive: false },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      ok: true,
      data: campaign,
      message: 'Campaign deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate campaign error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/campaigns/:id/fund - Fund campaign
router.post('/:id/fund', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = fundCampaignSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaign not found'
      });
    }

    if ((existingCampaign as any).isFunded) {
      return res.status(400).json({
        ok: false,
        error: 'Campaign is already funded'
      });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        isFunded: true,
        status: 'ACTIVE',
        vaultAddress: value.vaultAddress,
        fundingTxHash: value.fundingTxHash,
        startDate: value.startDate || new Date()
      } as any,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      ok: true,
      data: campaign,
      message: 'Campaign funded successfully'
    });
  } catch (error) {
    console.error('Fund campaign error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/campaigns/:id/status - Update campaign status
router.post('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { error, value } = campaignStatusSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    // Check if campaign exists
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        ok: false,
        error: 'Campaign not found'
      });
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['ACTIVE', 'CANCELED'],
      'ACTIVE': ['PAUSED', 'COMPLETED', 'CANCELED'],
      'PAUSED': ['ACTIVE', 'COMPLETED', 'CANCELED'],
      'COMPLETED': [],
      'CANCELED': []
    };

    if (!validTransitions[(existingCampaign as any).status]?.includes(value.status)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid status transition from ${(existingCampaign as any).status} to ${value.status}`
      });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: value.status } as any,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json({
      ok: true,
      data: campaign,
      message: `Campaign status updated to ${value.status}`
    });
  } catch (error) {
    console.error('Update campaign status error:', error);
    res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export { router as campaignRoutes };
