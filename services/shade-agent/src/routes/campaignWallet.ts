import { Hono } from "hono";
import { CampaignWalletManager, CampaignWalletInfo, WithdrawalRequest } from "../utils/campaignWallet";
import { simpleTokenAuthMiddleware } from "../middleware/auth";

const app = new Hono();

// Apply authentication middleware to all campaign wallet routes
app.use("*", simpleTokenAuthMiddleware);

/**
 * Generate or get campaign wallet information
 * GET /api/campaign-wallet/:campaignId/:chain
 */
app.get("/:campaignId/:chain", async (c) => {
  try {
    const campaignId = c.req.param("campaignId");
    const chain = c.req.param("chain");

    if (!campaignId || !chain) {
      return c.json({ 
        error: "Campaign ID and chain are required" 
      }, 400);
    }

    const walletInfo = await CampaignWalletManager.getCampaignWallet(campaignId, chain);
    
    return c.json({
      success: true,
      data: walletInfo
    });

  } catch (error) {
    console.error("Error getting campaign wallet:", error);
    return c.json({ 
      error: "Failed to get campaign wallet",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

/**
 * Check funding status of a campaign wallet
 * GET /api/campaign-wallet/:campaignId/:chain/funding-status
 */
app.get("/:campaignId/:chain/funding-status", async (c) => {
  try {
    const campaignId = c.req.param("campaignId");
    const chain = c.req.param("chain");

    if (!campaignId || !chain) {
      return c.json({ 
        error: "Campaign ID and chain are required" 
      }, 400);
    }

    const fundingStatus = await CampaignWalletManager.checkFundingStatus(campaignId, chain);
    
    return c.json({
      success: true,
      data: fundingStatus
    });

  } catch (error) {
    console.error("Error checking funding status:", error);
    return c.json({ 
      error: "Failed to check funding status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

/**
 * Withdraw funds from a campaign wallet
 * POST /api/campaign-wallet/withdraw
 */
app.post("/withdraw", async (c) => {
  try {
    let requestBody;
    try {
      requestBody = await c.req.json();
    } catch (jsonError) {
      return c.json({ 
        error: "Invalid JSON in request body",
        details: jsonError instanceof Error ? jsonError.message : "Unknown JSON error"
      }, 400);
    }

    const { campaignId, chain, recipientAddress, amount } = requestBody;

    if (!campaignId || !chain || !recipientAddress) {
      return c.json({ 
        error: "campaignId, chain, and recipientAddress are required" 
      }, 400);
    }

    const withdrawalRequest: WithdrawalRequest = {
      campaignId,
      chain,
      recipientAddress,
      amount
    };

    const withdrawalResult = await CampaignWalletManager.withdrawFunds(withdrawalRequest);
    
    return c.json({
      success: withdrawalResult.success,
      data: withdrawalResult
    });

  } catch (error) {
    console.error("Error withdrawing funds:", error);
    return c.json({ 
      error: "Failed to withdraw funds",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

/**
 * Generate a new campaign wallet
 * POST /api/campaign-wallet/generate
 */
app.post("/generate", async (c) => {
  try {
    let requestBody;
    try {
      requestBody = await c.req.json();
    } catch (jsonError) {
      return c.json({ 
        error: "Invalid JSON in request body",
        details: jsonError instanceof Error ? jsonError.message : "Unknown JSON error"
      }, 400);
    }

    const { campaignId, chain } = requestBody;

    if (!campaignId || !chain) {
      return c.json({ 
        error: "campaignId and chain are required" 
      }, 400);
    }

    const walletInfo = await CampaignWalletManager.generateCampaignWallet(campaignId, chain);
    
    return c.json({
      success: true,
      data: walletInfo
    });

  } catch (error) {
    console.error("Error generating campaign wallet:", error);
    return c.json({ 
      error: "Failed to generate campaign wallet",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
