import { Hono } from "hono";
import { CampaignWalletManager, CampaignWalletInfo, WithdrawalRequest } from "../utils/campaignWallet";
import { simpleTokenAuthMiddleware } from "../middleware/auth";

const app = new Hono();

// Apply authentication middleware to all campaign wallet routes
app.use("*", simpleTokenAuthMiddleware);

/**
 * Generate or get campaign wallet information
 * GET /api/campaign-wallet/:campaignId/:chain
 * Query params: tokenAddresses (comma-separated list of ERC20 token addresses)
 */
app.get("/:campaignId/:chain", async (c) => {
  try {
    const campaignId = c.req.param("campaignId");
    const chain = c.req.param("chain");
    const tokenAddressesParam = c.req.query("tokenAddresses");

    if (!campaignId || !chain) {
      return c.json({ 
        error: "Campaign ID and chain are required" 
      }, 400);
    }

    // Parse token addresses if provided
    let tokenAddresses: string[] | undefined;
    if (tokenAddressesParam) {
      tokenAddresses = tokenAddressesParam.split(',').map(addr => addr.trim()).filter(addr => addr);
    }

    const walletInfo = await CampaignWalletManager.getCampaignWallet(campaignId, chain, tokenAddresses);
    
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
 * Query params: tokenAddresses (comma-separated list of ERC20 token addresses)
 */
app.get("/:campaignId/:chain/funding-status", async (c) => {
  try {
    const campaignId = c.req.param("campaignId");
    const chain = c.req.param("chain");
    const tokenAddressesParam = c.req.query("tokenAddresses");

    if (!campaignId || !chain) {
      return c.json({ 
        error: "Campaign ID and chain are required" 
      }, 400);
    }

    // Parse token addresses if provided
    let tokenAddresses: string[] | undefined;
    if (tokenAddressesParam) {
      tokenAddresses = tokenAddressesParam.split(',').map(addr => addr.trim()).filter(addr => addr);
    }

    const fundingStatus = await CampaignWalletManager.checkFundingStatus(campaignId, chain);
    
    // Get token balances if requested
    let tokenBalances;
    if (tokenAddresses && tokenAddresses.length > 0) {
      try {
        const { ERC20Manager } = await import("../utils/erc20");
        tokenBalances = await ERC20Manager.getMultipleTokenBalances(fundingStatus.walletAddress, tokenAddresses, chain);
      } catch (error) {
        console.warn("Failed to get token balances for funding status:", error);
      }
    }
    
    return c.json({
      success: true,
      data: {
        ...fundingStatus,
        tokenBalances
      }
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
 * Supports both native tokens and ERC20 tokens
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

    const { campaignId, chain, recipientAddress, amount, tokenAddress } = requestBody;

    if (!campaignId || !chain || !recipientAddress) {
      return c.json({ 
        error: "campaignId, chain, and recipientAddress are required" 
      }, 400);
    }

    const withdrawalRequest: WithdrawalRequest = {
      campaignId,
      chain,
      recipientAddress,
      amount,
      tokenAddress
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
 * Supports checking ERC20 token balances during generation
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

    const { campaignId, chain, tokenAddresses } = requestBody;

    if (!campaignId || !chain) {
      return c.json({ 
        error: "campaignId and chain are required" 
      }, 400);
    }

    const walletInfo = await CampaignWalletManager.generateCampaignWallet(campaignId, chain, tokenAddresses);
    
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

/**
 * Get ERC20 token information
 * GET /api/campaign-wallet/token-info/:tokenAddress/:chain
 */
app.get("/token-info/:tokenAddress/:chain", async (c) => {
  try {
    const tokenAddress = c.req.param("tokenAddress");
    const chain = c.req.param("chain");

    if (!tokenAddress || !chain) {
      return c.json({ 
        error: "Token address and chain are required" 
      }, 400);
    }

    const { ERC20Manager } = await import("../utils/erc20");
    const tokenInfo = await ERC20Manager.getTokenInfo(tokenAddress, chain);
    
    return c.json({
      success: true,
      data: tokenInfo
    });

  } catch (error) {
    console.error("Error getting token info:", error);
    return c.json({ 
      error: "Failed to get token information",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

/**
 * Get ERC20 token balance for a campaign wallet
 * GET /api/campaign-wallet/:campaignId/:chain/token-balance/:tokenAddress
 */
app.get("/:campaignId/:chain/token-balance/:tokenAddress", async (c) => {
  try {
    const campaignId = c.req.param("campaignId");
    const chain = c.req.param("chain");
    const tokenAddress = c.req.param("tokenAddress");

    if (!campaignId || !chain || !tokenAddress) {
      return c.json({ 
        error: "Campaign ID, chain, and token address are required" 
      }, 400);
    }

    // Get campaign wallet address
    const walletInfo = await CampaignWalletManager.getCampaignWallet(campaignId, chain);
    
    // Get token balance
    const { ERC20Manager } = await import("../utils/erc20");
    const tokenBalance = await ERC20Manager.getTokenBalance(walletInfo.walletAddress, tokenAddress, chain);
    
    return c.json({
      success: true,
      data: {
        campaignId,
        chain,
        walletAddress: walletInfo.walletAddress,
        tokenBalance
      }
    });

  } catch (error) {
    console.error("Error getting token balance:", error);
    return c.json({ 
      error: "Failed to get token balance",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
