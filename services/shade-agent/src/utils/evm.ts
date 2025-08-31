import { contracts, chainAdapters } from "chainsig.js";
import { createPublicClient, http } from "viem";

// Centralized RPC configuration
export const getRpcUrl = (chain: string = "theta-365") => {
  switch (chain) {
    case "theta-361":
      return "https://eth-rpc-api.thetatoken.org/rpc";
    case "theta-365":
      return "https://eth-rpc-api-testnet.thetatoken.org/rpc";
    case "ethereum-1":
      return "https://eth.llamarpc.com";
    case "ethereum-11155111":
      return "https://rpc.sepolia.org";
    default:
      return process.env.THETA_TESTNET_RPC_URL || "https://eth-rpc-api-testnet.thetatoken.org/rpc";
  }
};

// Helper function to determine if a chain uses legacy transaction signing
const isLegacyChain = (chain: string): boolean => {
  const legacyChains = ["theta-361", "theta-365"];
  return legacyChains.includes(chain);
};

// Set up a chain signature contract instance
const MPC_CONTRACT = new contracts.ChainSignatureContract({
  networkId: `mainnet`,
  contractId: `v1.signer`,
});

// Set up a public client for the default network (Theta testnet)
const publicClient = createPublicClient({
  transport: http(getRpcUrl()),
});

// Set up a chain signatures chain adapter for the EVM network
export const Evm = new chainAdapters.evm.EVM({
  publicClient,
  contract: MPC_CONTRACT,
}) as any;

// Export the RPC URL for use in other files
export const defaultRpcUrl = getRpcUrl();

// Wrapper function for preparing transactions that handles both legacy and modern chains
export const prepareTransactionForSigning = async (params: any, chain: string = "theta-365") => {
  if (isLegacyChain(chain)) {
    return await Evm.prepareTransactionForSigningLegacy(params);
  } else {
    return await Evm.prepareTransactionForSigning(params);
  }
};

// Wrapper function for finalizing transactions that handles both legacy and modern chains
export const finalizeTransactionSigning = (params: any, chain: string = "theta-365") => {
  if (isLegacyChain(chain)) {
    return Evm.finalizeTransactionSigningLegacy(params);
  } else {
    return Evm.finalizeTransactionSigning(params);
  }
};
