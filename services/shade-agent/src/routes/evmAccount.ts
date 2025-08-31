import { Hono } from "hono";
import { Evm } from "../utils/evm";
import { JsonRpcProvider } from "ethers";
import { getRpcUrl } from "../utils/evm";

const app = new Hono();

app.get("/", async (c) => {
  // Get chain from query parameter or use default
  const chain = c.req.query("chain") || "theta-365";
  
  // Fetch the environment variable inside the route
  const contractId = process.env.NEXT_PUBLIC_contractId;
  if (!contractId) {
    return c.json({ error: "Contract ID not configured" }, 500);
  }

  try {
    // Derive the address for the specified chain
    const { address: senderAddress } = await Evm.deriveAddressAndPublicKey(
      contractId,
      chain,
    );

    // Get the balance of the address
      // Get balance from the blockchain
      const provider = new JsonRpcProvider(getRpcUrl(chain));
      const balance = await provider.getBalance(senderAddress);
    
    return c.json({ 
      senderAddress, 
      balance: Number(balance),
      chain 
    });
  } catch (error) {
    console.log("Error getting the derived address:", error);
    return c.json({ error: "Failed to get the derived address" }, 500);
  }
});

// Alternative endpoint with chain in path
app.get("/:chain", async (c) => {
  const chain = c.req.param("chain");
  
  // Fetch the environment variable inside the route
  const contractId = process.env.NEXT_PUBLIC_contractId;
  if (!contractId) {
    return c.json({ error: "Contract ID not configured" }, 500);
  }

  try {
    // Derive the address for the specified chain
    const { address: senderAddress } = await Evm.deriveAddressAndPublicKey(
      contractId,
      chain,
    );

    // Get the balance of the address
    const balance = await Evm.getBalance(senderAddress);
    
    return c.json({ 
      senderAddress, 
      balance: Number(balance.balance),
      chain 
    });
  } catch (error) {
    console.log("Error getting the derived address:", error);
    return c.json({ error: "Failed to get the derived address" }, 500);
  }
});

export default app;
