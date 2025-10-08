import { Hono } from "hono";
import { requestSignature } from "@neardefi/shade-agent-js";
import { Evm, getRpcUrl, prepareTransactionForSigning, finalizeTransactionSigning } from "../utils/evm";
import { JsonRpcProvider } from "ethers";
import { utils } from "chainsig.js";
const { toRSV, uint8ArrayToHex } = utils.cryptography;

const app = new Hono();

// Send TFUEL transaction on Theta blockchain
app.post("/send", async (c) => {
  try {
    // Add logging to debug the request
    console.log("Received transaction request");
    
    let requestBody;
    try {
      requestBody = await c.req.json();
      console.log("Request body:", requestBody);
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      return c.json({ 
        error: "Invalid JSON in request body",
        details: jsonError instanceof Error ? jsonError.message : "Unknown JSON error"
      }, 400);
    }

    const { 
      recipientAddress, 
      amount, 
      chain = "theta-365",
      gasLimit = "21000"
    } = requestBody;

    if (!recipientAddress || !amount) {
      return c.json({ 
        error: "recipientAddress and amount are required" 
      }, 400);
    }

    // Validate recipient address format
    if (!recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
      return c.json({ 
        error: "Invalid recipient address format" 
      }, 400);
    }

    // use process.env.NEXT_PUBLIC_contractId_LOCAL if not exist use process.env.NEXT_PUBLIC_contractId
    const contractId = process.env.NEXT_PUBLIC_contractId_LOCAL || process.env.NEXT_PUBLIC_contractId;
    if (!contractId) {
      return c.json({ error: "Contract ID not configured" }, 500);
    }

    // Derive the sender address for the specified chain
    const { address: senderAddress } = await Evm.deriveAddressAndPublicKey(
      contractId,
      chain,
    );

    console.log("Sender address:", senderAddress);

    // Get current gas price
    const provider = new JsonRpcProvider(getRpcUrl(chain));
    
    const gasPrice = await provider.getFeeData();
    const nonce = await provider.getTransactionCount(senderAddress);

    // Prepare the transaction for signing
    const { transaction, hashesToSign } = await prepareTransactionForSigning({
      from: senderAddress,
      to: recipientAddress,
      value: amount,
      data: "0x", // Empty data for TFUEL transfer
      gasLimit: gasLimit,
      gasPrice: gasPrice.gasPrice?.toString() || "20000000000", // 20 gwei default
      nonce: nonce,
    }, chain);

    // Get signature from the agent
    console.log("Requesting signature for chain:", chain);
    const signRes = await requestSignature({
      path: chain,
      payload: uint8ArrayToHex(hashesToSign[0]),
    });
    console.log("Signature received:", signRes);

    // Reconstruct the signed transaction
    console.log("Finalizing transaction signing");
    const signedTransaction = finalizeTransactionSigning({
      transaction,
      rsvSignatures: [toRSV(signRes)],
    }, chain);
    console.log("Transaction finalized, broadcasting...");

    // Broadcast the transaction
    let txHash;
    try {
      txHash = await Evm.broadcastTx(signedTransaction);
      console.log("Transaction broadcasted successfully:", txHash);
    } catch (broadcastError) {
      console.error("Broadcast error:", broadcastError);
      throw new Error(`Broadcast failed: ${broadcastError instanceof Error ? broadcastError.message : 'Unknown broadcast error'}`);
    }

    return c.json({
      success: true,
      message: "Transaction sent successfully",
      txHash: txHash.hash,
      senderAddress,
      recipientAddress,
      amount,
      chain,
      gasUsed: gasLimit,
      gasPrice: gasPrice.gasPrice?.toString()
    });

  } catch (error) {
    console.error("Transaction error:", error);
    return c.json({ 
      error: "Failed to send transaction",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Get transaction status
app.get("/status/:txHash", async (c) => {
  try {
    const txHash = c.req.param("txHash");
    const chain = c.req.query("chain") || "theta-365";
    
    if (!txHash) {
      return c.json({ error: "Transaction hash is required" }, 400);
    }

    const provider = new JsonRpcProvider(getRpcUrl(chain));
    
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return c.json({
        success: true,
        txHash,
        status: "pending",
        message: "Transaction not yet confirmed"
      });
    }

    return c.json({
      success: true,
      txHash,
      status: receipt.status === 1 ? "confirmed" : "failed",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

  } catch (error) {
    console.error("Status check error:", error);
    return c.json({ error: "Failed to get transaction status" }, 500);
  }
});

// Get estimated gas for a transaction
app.post("/estimate-gas", async (c) => {
  try {
    // Add logging to debug the request
    console.log("Received gas estimation request");
    
    let requestBody;
    try {
      requestBody = await c.req.json();
      console.log("Request body:", requestBody);
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      return c.json({ 
        error: "Invalid JSON in request body",
        details: jsonError instanceof Error ? jsonError.message : "Unknown JSON error"
      }, 400);
    }

    const { 
      recipientAddress, 
      amount, 
      chain = "theta-365"
    } = requestBody;

    if (!recipientAddress || !amount) {
      return c.json({ 
        error: "recipientAddress and amount are required" 
      }, 400);
    }

    // use process.env.NEXT_PUBLIC_contractId_LOCAL if not exist use process.env.NEXT_PUBLIC_contractId
    const contractId = process.env.NEXT_PUBLIC_contractId_LOCAL || process.env.NEXT_PUBLIC_contractId;
    if (!contractId) {
      return c.json({ error: "Contract ID not configured" }, 500);
    }

    const { address: senderAddress } = await Evm.deriveAddressAndPublicKey(
      contractId,
      chain,
    );

    const provider = new JsonRpcProvider(getRpcUrl(chain));

    // Estimate gas for the transaction
    const gasEstimate = await provider.estimateGas({
      from: senderAddress,
      to: recipientAddress,
      value: amount,
      data: "0x"
    });

    const gasPrice = await provider.getFeeData();

    return c.json({
      success: true,
      estimatedGas: gasEstimate.toString(),
      gasPrice: gasPrice.gasPrice?.toString(),
      estimatedCost: (BigInt(gasEstimate) * (gasPrice.gasPrice || BigInt(0))).toString()
    });

  } catch (error) {
    console.error("Gas estimation error:", error);
    return c.json({ 
      error: "Failed to estimate gas",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
