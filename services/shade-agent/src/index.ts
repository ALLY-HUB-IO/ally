import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from shared infra/.env file
const envPath = path.resolve(process.cwd(), "../../infra/.env");
dotenv.config({ path: envPath });

// Import routes
import evmAccount from "./routes/evmAccount";
import agentAccount from "./routes/agentAccount";
import transaction from "./routes/transaction";


const app = new Hono();

// Configure CORS to restrict access to the server
app.use(cors());

// Health check endpoint for Docker Compose
app.get("/:healthz", (c) => c.json({ status: "healthy", service: "shade-agent" }));

// Root endpoint
app.get("/", (c) => c.json({ message: "Ally Shade Agent API", status: "running" }));

// Routes
app.route("/api/evm-account", evmAccount);
app.route("/api/agent-account", agentAccount);
app.route("/api/transaction", transaction);


// Start the server
const port = Number(process.env.SHADE_AGENT_HTTP_PORT || process.env.PORT || "8090");

console.log(`Ally Shade Agent is running on port ${port}`);
console.log(`Environment loaded from: ${envPath}`);

serve({ fetch: app.fetch, port });
