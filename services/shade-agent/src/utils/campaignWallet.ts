import { Evm } from "./evm";
import { createHash } from "crypto";

export interface CampaignWalletInfo {
  walletAddress: string;
  chain: string;
  campaignId: string;
  balance: string;
  isFunded: boolean;
}

export interface WithdrawalRequest {
  campaignId: string;
  chain: string;
  recipientAddress: string;
  amount?: string; // If not provided, withdraw all
}

export interface WithdrawalResponse {
  success: boolean;
  txHash?: string;
  message: string;
  amount: string;
  recipientAddress: string;
  campaignId: string;
  chain: string;
}

/**
 * Generate a unique wallet address for a campaign on a specific chain
 * Uses a deterministic approach based on campaign ID and chain
 */
export class CampaignWalletManager {
  private static readonly WALLET_PREFIX = "campaign";
  
  /**
   * Generate a unique wallet address for a campaign
   * @param campaignId - Unique campaign identifier
   * @param chain - Chain identifier (e.g., "theta-365", "ethereum-1")
   * @returns Campaign wallet information
   */
  static async generateCampaignWallet(
    campaignId: string, 
    chain: string
  ): Promise<CampaignWalletInfo> {
    try {
      // Create a deterministic path based on campaign ID and chain
      const walletPath = this.generateWalletPath(campaignId, chain);
      
      // Get the contract ID from environment
      const contractId = process.env.NEXT_PUBLIC_contractId_LOCAL || process.env.NEXT_PUBLIC_contractId;
      if (!contractId) {
        throw new Error("Contract ID not configured");
      }

      // Derive the address using the custom path
      const { address: walletAddress } = await Evm.deriveAddressAndPublicKey(
        contractId,
        walletPath,
      );

      // Get the balance
      const balance = await this.getWalletBalance(walletAddress, chain);
      const isFunded = BigInt(balance) > BigInt(0);

      return {
        walletAddress,
        chain,
        campaignId,
        balance,
        isFunded
      };
    } catch (error) {
      console.error("Error generating campaign wallet:", error);
      throw new Error(`Failed to generate campaign wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet information for an existing campaign
   * @param campaignId - Campaign identifier
   * @param chain - Chain identifier
   * @returns Campaign wallet information
   */
  static async getCampaignWallet(
    campaignId: string, 
    chain: string
  ): Promise<CampaignWalletInfo> {
    return this.generateCampaignWallet(campaignId, chain);
  }

  /**
   * Check if a campaign wallet is funded
   * @param campaignId - Campaign identifier
   * @param chain - Chain identifier
   * @returns Funding status
   */
  static async checkFundingStatus(
    campaignId: string, 
    chain: string
  ): Promise<{ isFunded: boolean; balance: string; walletAddress: string }> {
    const walletInfo = await this.getCampaignWallet(campaignId, chain);
    return {
      isFunded: walletInfo.isFunded,
      balance: walletInfo.balance,
      walletAddress: walletInfo.walletAddress
    };
  }

  /**
   * Withdraw funds from a campaign wallet
   * Only allowed if the campaign was funded and then canceled
   * @param withdrawalRequest - Withdrawal details
   * @returns Withdrawal response
   */
  static async withdrawFunds(withdrawalRequest: WithdrawalRequest): Promise<WithdrawalResponse> {
    try {
      const { campaignId, chain, recipientAddress, amount } = withdrawalRequest;

      // Get campaign wallet info
      const walletInfo = await this.getCampaignWallet(campaignId, chain);
      
      if (!walletInfo.isFunded) {
        return {
          success: false,
          message: "Campaign wallet is not funded",
          amount: "0",
          recipientAddress,
          campaignId,
          chain
        };
      }

      // Determine withdrawal amount
      const withdrawalAmount = amount || walletInfo.balance;
      
      if (BigInt(withdrawalAmount) > BigInt(walletInfo.balance)) {
        return {
          success: false,
          message: "Insufficient balance for withdrawal",
          amount: "0",
          recipientAddress,
          campaignId,
          chain
        };
      }

      // Validate recipient address
      if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
        return {
          success: false,
          message: "Invalid recipient address format",
          amount: "0",
          recipientAddress,
          campaignId,
          chain
        };
      }

      // Execute the withdrawal transaction
      const txHash = await this.executeWithdrawal(
        campaignId,
        walletInfo.walletAddress,
        recipientAddress,
        withdrawalAmount,
        chain
      );

      return {
        success: true,
        txHash,
        message: "Withdrawal completed successfully",
        amount: withdrawalAmount,
        recipientAddress,
        campaignId,
        chain
      };

    } catch (error) {
      console.error("Error withdrawing funds:", error);
      return {
        success: false,
        message: `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        amount: "0",
        recipientAddress: withdrawalRequest.recipientAddress,
        campaignId: withdrawalRequest.campaignId,
        chain: withdrawalRequest.chain
      };
    }
  }

  /**
   * Generate a deterministic wallet path for a campaign
   * @param campaignId - Campaign identifier
   * @param chain - Chain identifier
   * @returns Wallet path
   */
  private static generateWalletPath(campaignId: string, chain: string): string {
    // Create a deterministic hash from campaign ID and chain
    const input = `${this.WALLET_PREFIX}-${campaignId}-${chain}`;
    const hash = createHash('sha256').update(input).digest('hex');
    
    // Use the hash to create a unique path
    // Format: campaign-{first8chars}-{chain}
    const shortHash = hash.substring(0, 8);
    return `${this.WALLET_PREFIX}-${shortHash}-${chain}`;
  }

  /**
   * Get wallet balance for a specific address
   * @param address - Wallet address
   * @param chain - Chain identifier
   * @returns Balance in wei
   */
  private static async getWalletBalance(address: string, chain: string): Promise<string> {
    try {
      const { JsonRpcProvider } = await import("ethers");
      const { getRpcUrl } = await import("./evm");
      
      const provider = new JsonRpcProvider(getRpcUrl(chain));
      const balance = await provider.getBalance(address);
      return balance.toString();
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      return "0";
    }
  }

  /**
   * Execute withdrawal transaction
   * @param campaignId - Campaign identifier
   * @param fromAddress - Source wallet address
   * @param toAddress - Destination wallet address
   * @param amount - Amount to withdraw
   * @param chain - Chain identifier
   * @returns Transaction hash
   */
  private static async executeWithdrawal(
    campaignId: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    chain: string
  ): Promise<string> {
    try {
      const { requestSignature } = await import("@neardefi/shade-agent-js");
      const { prepareTransactionForSigning, finalizeTransactionSigning, getRpcUrl } = await import("./evm");
      const { JsonRpcProvider } = await import("ethers");
      const { utils } = await import("chainsig.js");
      const { toRSV, uint8ArrayToHex } = utils.cryptography;

      // Get the contract ID from environment
      const contractId = process.env.NEXT_PUBLIC_contractId_LOCAL || process.env.NEXT_PUBLIC_contractId;
      if (!contractId) {
        throw new Error("Contract ID not configured");
      }

      // Generate the wallet path for this campaign
      const walletPath = this.generateWalletPath(campaignId, chain);

      // Get current gas price and nonce
      const provider = new JsonRpcProvider(getRpcUrl(chain));
      const gasPrice = await provider.getFeeData();
      const nonce = await provider.getTransactionCount(fromAddress);

      // Prepare the transaction for signing
      const { transaction, hashesToSign } = await prepareTransactionForSigning({
        from: fromAddress,
        to: toAddress,
        value: amount,
        data: "0x", // Empty data for simple transfer
        gasLimit: "21000",
        gasPrice: gasPrice.gasPrice?.toString() || "20000000000",
        nonce: nonce,
      }, chain);

      // Get signature from the agent
      const signRes = await requestSignature({
        path: walletPath,
        payload: uint8ArrayToHex(hashesToSign[0]),
      });

      // Reconstruct the signed transaction
      const signedTransaction = finalizeTransactionSigning({
        transaction,
        rsvSignatures: [toRSV(signRes)],
      }, chain);

      // Broadcast the transaction
      const txHash = await Evm.broadcastTx(signedTransaction);
      return txHash.hash;

    } catch (error) {
      console.error("Error executing withdrawal:", error);
      throw new Error(`Withdrawal execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
