import { JsonRpcProvider, Contract, formatUnits, parseUnits } from "ethers";
import { getRpcUrl } from "./evm";

// ERC20 ABI - minimal interface for balance and transfer operations
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)"
];

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
}

export interface TokenBalance {
  tokenAddress: string;
  balance: string;
  formattedBalance: string;
  symbol: string;
  decimals: number;
}

export interface TokenTransferRequest {
  tokenAddress: string;
  recipientAddress: string;
  amount: string; // Amount in token units (not wei)
  chain: string;
}

export class ERC20Manager {
  /**
   * Get token information
   * @param tokenAddress - ERC20 token contract address
   * @param chain - Chain identifier
   * @returns Token information
   */
  static async getTokenInfo(tokenAddress: string, chain: string): Promise<TokenInfo> {
    try {
      const provider = new JsonRpcProvider(getRpcUrl(chain));
      const contract = new Contract(tokenAddress, ERC20_ABI, provider);

      const [symbol, name, decimals, totalSupply] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals(),
        contract.totalSupply()
      ]);

      return {
        address: tokenAddress,
        symbol,
        name,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString()
      };
    } catch (error) {
      console.error("Error getting token info:", error);
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token balance for an address
   * @param walletAddress - Wallet address to check
   * @param tokenAddress - ERC20 token contract address
   * @param chain - Chain identifier
   * @returns Token balance information
   */
  static async getTokenBalance(
    walletAddress: string, 
    tokenAddress: string, 
    chain: string
  ): Promise<TokenBalance> {
    try {
      const provider = new JsonRpcProvider(getRpcUrl(chain));
      const contract = new Contract(tokenAddress, ERC20_ABI, provider);

      const [balance, decimals, symbol] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals(),
        contract.symbol()
      ]);

      const formattedBalance = formatUnits(balance, decimals);

      return {
        tokenAddress,
        balance: balance.toString(),
        formattedBalance,
        symbol,
        decimals: Number(decimals)
      };
    } catch (error) {
      console.error("Error getting token balance:", error);
      throw new Error(`Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prepare ERC20 transfer transaction data
   * @param recipientAddress - Recipient address
   * @param amount - Amount in token units
   * @param tokenAddress - ERC20 token contract address
   * @param chain - Chain identifier
   * @returns Transaction data for ERC20 transfer
   */
  static async prepareERC20Transfer(
    recipientAddress: string,
    amount: string,
    tokenAddress: string,
    chain: string
  ): Promise<{ data: string; gasEstimate: string }> {
    try {
      const provider = new JsonRpcProvider(getRpcUrl(chain));
      const contract = new Contract(tokenAddress, ERC20_ABI, provider);

      // Get token decimals to convert amount properly
      const decimals = await contract.decimals();
      const amountInWei = parseUnits(amount, decimals);

      // Encode the transfer function call
      const data = contract.interface.encodeFunctionData("transfer", [recipientAddress, amountInWei]);

      // Estimate gas for the transfer
      const gasEstimate = await provider.estimateGas({
        to: tokenAddress,
        data: data
      });

      return {
        data,
        gasEstimate: gasEstimate.toString()
      };
    } catch (error) {
      console.error("Error preparing ERC20 transfer:", error);
      throw new Error(`Failed to prepare ERC20 transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute ERC20 transfer transaction
   * @param fromAddress - Sender address
   * @param recipientAddress - Recipient address
   * @param amount - Amount in token units
   * @param tokenAddress - ERC20 token contract address
   * @param chain - Chain identifier
   * @param walletPath - Wallet path for signing
   * @returns Transaction hash
   */
  static async executeERC20Transfer(
    fromAddress: string,
    recipientAddress: string,
    amount: string,
    tokenAddress: string,
    chain: string,
    walletPath: string
  ): Promise<string> {
    try {
      const { requestSignature } = await import("@neardefi/shade-agent-js");
      const { prepareTransactionForSigning, finalizeTransactionSigning, getRpcUrl } = await import("./evm");
      const { JsonRpcProvider } = await import("ethers");
      const { utils } = await import("chainsig.js");
      const { toRSV, uint8ArrayToHex } = utils.cryptography;

      const provider = new JsonRpcProvider(getRpcUrl(chain));
      const contract = new Contract(tokenAddress, ERC20_ABI, provider);

      // Get token decimals and convert amount
      const decimals = await contract.decimals();
      const amountInWei = parseUnits(amount, decimals);

      // Prepare transaction data
      const data = contract.interface.encodeFunctionData("transfer", [recipientAddress, amountInWei]);

      // Get current gas price and nonce
      const gasPrice = await provider.getFeeData();
      const nonce = await provider.getTransactionCount(fromAddress);

      // Estimate gas for the transaction
      const gasEstimate = await provider.estimateGas({
        from: fromAddress,
        to: tokenAddress,
        data: data
      });

      // Prepare the transaction for signing
      const { transaction, hashesToSign } = await prepareTransactionForSigning({
        from: fromAddress,
        to: tokenAddress,
        value: "0", // ERC20 transfers have 0 value
        data: data,
        gasLimit: gasEstimate.toString(),
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
      const { Evm } = await import("./evm");
      const txHash = await Evm.broadcastTx(signedTransaction);
      return txHash.hash;

    } catch (error) {
      console.error("Error executing ERC20 transfer:", error);
      throw new Error(`ERC20 transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate ERC20 token address format
   * @param tokenAddress - Token contract address
   * @returns True if valid
   */
  static isValidTokenAddress(tokenAddress: string): boolean {
    return tokenAddress.startsWith('0x') && tokenAddress.length === 42;
  }

  /**
   * Get multiple token balances for a wallet
   * @param walletAddress - Wallet address
   * @param tokenAddresses - Array of token contract addresses
   * @param chain - Chain identifier
   * @returns Array of token balances
   */
  static async getMultipleTokenBalances(
    walletAddress: string,
    tokenAddresses: string[],
    chain: string
  ): Promise<TokenBalance[]> {
    try {
      const balancePromises = tokenAddresses.map(tokenAddress => 
        this.getTokenBalance(walletAddress, tokenAddress, chain)
      );

      const balances = await Promise.allSettled(balancePromises);
      
      return balances
        .filter((result): result is PromiseFulfilledResult<TokenBalance> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);
    } catch (error) {
      console.error("Error getting multiple token balances:", error);
      throw new Error(`Failed to get token balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
