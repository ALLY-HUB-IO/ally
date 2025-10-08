import { Context, Next } from "hono";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Middleware for secure communication between admin service and shade-agent
 * Uses HMAC-based authentication with shared secret
 */
export const adminAuthMiddleware = async (c: Context, next: Next) => {
  try {
    // Get the authorization header
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader) {
      return c.json({ 
        error: "Authorization header is required" 
      }, 401);
    }

    // Extract the token from "Bearer <token>" format
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return c.json({ 
        error: "Invalid authorization format" 
      }, 401);
    }

    // Get the shared secret from environment
    const sharedSecret = process.env.ADMIN_SHADE_AGENT_SECRET;
    
    if (!sharedSecret) {
      console.error("ADMIN_SHADE_AGENT_SECRET not configured");
      return c.json({ 
        error: "Authentication not configured" 
      }, 500);
    }

    // Get the request body for HMAC verification
    const requestBody = await c.req.text();
    const method = c.req.method;
    const path = c.req.url;
    
    // Create the message to sign
    const message = `${method}:${path}:${requestBody}`;
    
    // Generate expected HMAC
    const expectedHmac = createHmac('sha256', sharedSecret)
      .update(message)
      .digest('hex');
    
    // Compare HMACs using timing-safe comparison
    const providedHmac = token;
    
    if (!timingSafeEqual(
      Buffer.from(expectedHmac, 'hex'),
      Buffer.from(providedHmac, 'hex')
    )) {
      return c.json({ 
        error: "Invalid authentication token" 
      }, 401);
    }

    // Authentication successful, continue to next middleware
    await next();
    
  } catch (error) {
    console.error("Authentication error:", error);
    return c.json({ 
      error: "Authentication failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
};

/**
 * Alternative middleware using simple token-based authentication
 * For cases where HMAC verification is not feasible
 */
export const simpleTokenAuthMiddleware = async (c: Context, next: Next) => {
  try {
    // Get the authorization header
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader) {
      return c.json({ 
        error: "Authorization header is required" 
      }, 401);
    }

    // Extract the token from "Bearer <token>" format
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return c.json({ 
        error: "Invalid authorization format" 
      }, 401);
    }

    // Get the expected token from environment
    const expectedToken = process.env.ADMIN_SHADE_AGENT_TOKEN;
    
    if (!expectedToken) {
      console.error("ADMIN_SHADE_AGENT_TOKEN not configured");
      return c.json({ 
        error: "Authentication not configured" 
      }, 500);
    }

    // Compare tokens using timing-safe comparison
    if (!timingSafeEqual(
      Buffer.from(token, 'utf8'),
      Buffer.from(expectedToken, 'utf8')
    )) {
      return c.json({ 
        error: "Invalid authentication token" 
      }, 401);
    }

    // Authentication successful, continue to next middleware
    await next();
    
  } catch (error) {
    console.error("Authentication error:", error);
    return c.json({ 
      error: "Authentication failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
};

/**
 * Generate HMAC token for admin service to use
 * This should be called by the admin service before making requests
 */
export const generateAdminToken = (
  method: string,
  path: string,
  body: string,
  sharedSecret: string
): string => {
  const message = `${method}:${path}:${body}`;
  return createHmac('sha256', sharedSecret)
    .update(message)
    .digest('hex');
};
