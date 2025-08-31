# Ally Shade Agent Service

This service provides cross-chain signing capabilities for the Ally platform, enabling secure reward payouts on external blockchains while maintaining centralized custody and policy control.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend/     │    │   Shade Agent    │    │   Shade Agent   │
│   Client        │───▶│   API Service    │───▶│   CLI (TEE)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌──────────────────┐    ┌──────────────────┐
                       │   Theta          │    │   NEAR           │
                       │   Blockchain     │    │   Blockchain     │
                       └──────────────────┘    └──────────────────┘
```

## 🚀 Quick Start

### **1. Prerequisites**
```bash
# Install NEAR CLI
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh

# Install Shade Agent CLI
npm i -g @neardefi/shade-agent-cli

# Verify installations
near --version
shade-agent-cli --version

# Ensure you have the contract deployed
cd services/shade-agent
shade-agent-cli deploy --wasm contract.wasm --network mainnet
```

### **2. Create NEAR Mainnet Account**
```bash
# Option A: Use NEAR Wallet (Recommended)
# Visit: https://wallet.near.org/
# Click 'Create Account' and follow the steps

# Option B: Use existing account
# If you already have a NEAR mainnet account, use that

# Option C: Generate keypair manually
near generate-key your-agent-account.near
```

### **3. Environment Configuration**
1. Copy the example environment file:
```bash
cp infra/example.env infra/.env
```

2. Edit `infra/.env` and update the following values:
```bash
# NEAR Configuration
NEAR_NETWORK=mainnet
NEAR_RPC_URL=https://rpc.mainnet.near.org
AGENT_ACCOUNT=your-agent-account.near
AGENT_ADMIN=your-agent-account.near
NEAR_ACCOUNT_ID=your-agent-account.near
NEAR_SEED_PHRASE="your twelve word seed phrase here"
NEXT_PUBLIC_contractId=ac-proxy.your-agent-account.near

# Shade Agent Configuration
SHADE_AGENT_HTTP_PORT=8090
SHADE_AGENT_TOKEN=$(openssl rand -hex 32)
```

### **4. Fund Your NEAR Account**
```bash
# Get mainnet NEAR tokens from exchanges or transfer from another wallet
# Visit: https://wallet.near.org/
# Or use exchanges: https://coinmarketcap.com/currencies/near-protocol/markets/
```

### **5. Start TEE Service Locally**
```bash
# From services/shade-agent directory
cd services/shade-agent
set -a && source ../../infra/.env && set +a && shade-agent-cli --wasm contract.wasm --funding 2
```

The CLI will:
- Deploy the agent contract to NEAR
- Generate API_CODEHASH and APP_CODEHASH
- Update your .env file automatically
- Start the TEE (Trusted Execution Environment)

### **6. Start API Service with Docker**
```bash
# From the infra directory
cd infra
docker compose up shade-agent
```

### **7. Verify Services**
```bash
# Check API service
curl http://localhost:8090/:healthz

# Check TEE service (should be running locally)
curl http://localhost:3140/health

# Test account endpoint
curl http://localhost:8090/api/evm-account
```

## 📋 API Endpoints

### **Health Check**
- `GET /:healthz` - Health check endpoint for Docker Compose

### **Account Endpoints**

#### `GET /api/evm-account`
Get the derived address and balance for the agent on a specific chain.

**Query Parameters:**
- `chain` (optional): Chain identifier (default: "theta-365")

**Examples:**
```bash
# Get Theta testnet address (default)
curl http://localhost:8090/api/evm-account

# Get Theta mainnet address
curl http://localhost:8090/api/evm-account?chain=theta-361

# Get Ethereum mainnet address
curl http://localhost:8090/api/evm-account?chain=ethereum-1
```

**Response:**
```json
{
  "senderAddress": "0x...",
  "balance": 1000000000000000000,
  "chain": "theta-365"
}
```

#### `GET /api/evm-account/:chain`
Get the derived address and balance for the agent on a specific chain using path parameter.

**Path Parameters:**
- `chain`: Chain identifier

**Examples:**
```bash
# Get Theta testnet address
curl http://localhost:8090/api/evm-account/theta-365

# Get Theta mainnet address
curl http://localhost:8090/api/evm-account/theta-361

# Get Ethereum mainnet address
curl http://localhost:8090/api/evm-account/ethereum-1
```

### **Transaction Endpoints**

#### `POST /api/transaction/send`
Send TFUEL transaction on Theta blockchain.

**Request Body:**
```json
{
  "recipientAddress": "0x1234567890123456789012345678901234567890",
  "amount": "1000000000000000000",
  "chain": "theta-365",
  "gasLimit": "21000"
}
```

**Parameters:**
- `recipientAddress` (required): The recipient's address
- `amount` (required): Amount in wei (1 TFUEL = 1000000000000000000 wei)
- `chain` (optional): Chain identifier (default: "theta-365")
- `gasLimit` (optional): Gas limit for transaction (default: "21000")

**Response:**
```json
{
  "success": true,
  "message": "Transaction sent successfully",
  "txHash": "0x...",
  "senderAddress": "0x...",
  "recipientAddress": "0x1234567890123456789012345678901234567890",
  "amount": "1000000000000000000",
  "chain": "theta-365",
  "gasUsed": "21000",
  "gasPrice": "20000000000"
}
```

#### `GET /api/transaction/status/:txHash`
Check the status of a transaction.

**Path Parameters:**
- `txHash`: Transaction hash to check

**Query Parameters:**
- `chain` (optional): Chain identifier (default: "theta-365")

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "status": "confirmed",
  "blockNumber": 12345,
  "gasUsed": "21000"
}
```

#### `POST /api/transaction/estimate-gas`
Estimate gas cost for a transaction.

**Request Body:**
```json
{
  "recipientAddress": "0x1234567890123456789012345678901234567890",
  "amount": "1000000000000000000",
  "chain": "theta-365"
}
```

**Response:**
```json
{
  "success": true,
  "estimatedGas": "21000",
  "gasPrice": "20000000000",
  "estimatedCost": "420000000000000"
}
```

### **Agent Account Endpoint**

#### `GET /api/agent-account`
Get agent account information and balance.

**Response:**
```json
{
  "accountId": "1af660a79008c0ce0c5a5605c6107fd7f355a41cb407d4728300a4e15b35cdbb",
  "balance": "298810407762894700000000"
}
```

## 🔧 Chain Identifiers

- `"theta-365"` - Theta testnet (default)
- `"theta-361"` - Theta mainnet
- `"ethereum-1"` - Ethereum mainnet
- `"ethereum-11155111"` - Ethereum Sepolia testnet

## 🐳 Docker Setup

### **Recommended: Hybrid Setup**
```bash
# Terminal 1: Run TEE service locally
cd services/shade-agent
shade-agent-cli --wasm contract.wasm --funding 2

# Terminal 2: Run API service in Docker
cd infra
docker compose up shade-agent
```

### **Alternative: Full Docker Setup**
```bash
# Start both services
docker compose up shade-agent shade-agent-cli
```

**Note**: The TEE service in Docker may have limitations due to Docker-in-Docker requirements.

## 📊 Health Checks

### **API Service Health Check**
```bash
curl http://localhost:8090/:healthz
# Expected: {"status":"healthy","service":"shade-agent"}
```

### **TEE Service Health Check**
```bash
curl http://localhost:3140/health
# Expected: {"status":"healthy"}
```

## 🎯 Example Usage

### **1. Check Service Health**
```bash
curl http://localhost:8090/:healthz
```

### **2. Get Agent Address and Balance (Theta Testnet - Default)**
```bash
curl http://localhost:8090/api/evm-account
```

### **3. Get Agent Address and Balance (Theta Mainnet)**
```bash
curl http://localhost:8090/api/evm-account?chain=theta-361
```

### **4. Get Agent Address and Balance (Ethereum Mainnet)**
```bash
curl http://localhost:8090/api/evm-account?chain=ethereum-1
```

### **5. Send 1 TFUEL Transaction**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "recipientAddress": "0x1234567890123456789012345678901234567890",
    "amount": "1000000000000000000"
  }' \
  http://localhost:8090/api/transaction/send
```

### **6. Estimate Gas for Transaction**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "recipientAddress": "0x1234567890123456789012345678901234567890",
    "amount": "1000000000000000000"
  }' \
  http://localhost:8090/api/transaction/estimate-gas
```

### **7. Check Transaction Status**
```bash
curl http://localhost:8090/api/transaction/status/0x...
```

## 🛠️ Development

### **Local Development**
```bash
npm run dev
```

### **Build**
```bash
npm run build
npm start
```

### **Docker**
```bash
npm run docker:build
```

## 📝 Environment Variables

### **Required for TEE Service**
```bash
NEAR_NETWORK=mainnet
NEAR_RPC_URL=https://rpc.mainnet.near.org
AGENT_ACCOUNT=your-agent-account.near
NEAR_ACCOUNT_ID=your-agent-account.near
NEAR_SEED_PHRASE=your-12-word-seed-phrase
```

### **Required for API Service**
```bash
SHADE_AGENT_HTTP_PORT=8090
SHADE_AGENT_TOKEN=your-secret-token
NEXT_PUBLIC_contractId=ac-proxy.your-agent-account.near
```

## 🛠️ Troubleshooting

### **Service Won't Start**
1. **Check logs**:
   ```bash
   docker compose logs shade-agent
   ```

2. **Verify contract deployment**:
   ```bash
   near account view-account-summary ac-proxy.your-agent-account.near
   ```

3. **Check environment variables**:
   ```bash
   docker compose config
   ```

### **TEE Service Issues**
1. **Contract not deployed**: Deploy the contract first
2. **Insufficient NEAR balance**: Fund the agent account
3. **Network connectivity**: Check NEAR RPC connectivity
4. **Port conflicts**: Ensure port 3140 is available

### **API Service Issues**
1. **TEE service not ready**: Ensure TEE service is running on port 3140
2. **Port conflicts**: Check if port 8090 is available
3. **Environment variables**: Verify all required env vars are set

### **Shade Agent CLI Issues**
1. **Ensure you're using the correct NEAR network (mainnet)**
2. **Verify your seed phrase is correct**
3. **Check that your account has sufficient NEAR for deployment**
4. **Run from the correct directory with environment variables loaded**

### **Logs**
```bash
# Docker logs
docker logs shade-agent

# Follow logs in real-time
docker logs -f shade-agent

# Shade Agent CLI logs
# Check the terminal where shade-agent-cli is running
```

## 🔒 Security Considerations

1. **NEAR Seed Phrase**: Keep secure and never commit to version control
2. **API Token**: Use strong, random tokens for production
3. **Network Access**: Limit container network access as needed
4. **Local TEE Service**: Ensure TEE service is only accessible locally
5. **HTTPS**: Use HTTPS in production environments
6. **Rate Limiting**: Consider implementing rate limiting for transaction endpoints
7. **Monitoring**: Monitor all transactions and implement alerts for failed transactions
8. **Backup**: Regularly backup your NEAR seed phrase and agent configuration

## 🚨 Emergency Procedures

### **Complete Service Shutdown**
```bash
# Stop all related containers
docker-compose down

# Or stop individual container
docker stop shade-agent
```

### **Emergency Withdrawal**
If the service is compromised or needs immediate shutdown:
1. Stop the service immediately
2. Use NEAR CLI to transfer remaining funds to a secure wallet
3. Document the incident and review security measures

## 🏭 Production Deployment

For production deployment:

1. **Switch to mainnet:**
   - Update `NEAR_NETWORK=mainnet` in `infra/.env`
   - Update `NEAR_RPC_URL=https://rpc.mainnet.near.org`
   - Create a mainnet NEAR account
   - Fund with real NEAR tokens

2. **Update contract ID:**
   - Change `NEXT_PUBLIC_contractId` prefix from `ac-proxy.` to `ac-sandbox.`

3. **Deploy to TEE:**
   - Use Phala Cloud or other TEE provider
   - Follow the [official deployment guide](https://docs.near.org/ai/shade-agents/quickstart/deploying)

4. **Security considerations:**
   - Use strong, unique tokens
   - Implement proper authentication
   - Monitor all transactions
   - Regular security audits

## 📚 Additional Resources

- [Shade Agent Documentation](https://docs.near.org/ai/shade-agents/)
- [NEAR CLI Documentation](https://docs.near.org/tools/near-cli)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🔗 Cross-Chain Transaction Flow

The Shade Agent uses Chain Signatures to execute transactions on external blockchains (like Theta) while keeping the signing keys secure in the TEE. The process works as follows:

1. Your backend calls the shade-agent API
2. The agent creates a Chain Signature request
3. The TEE signs the transaction
4. The signed transaction is submitted to the target blockchain

### **Funding the Derived Ethereum Account**
For Theta transactions, you need to fund the derived Ethereum account:

```bash
# Get the derived Ethereum account address
curl http://localhost:8090/api/evm-account

# Fund this account with:
# - TFUEL for Theta transactions
# - ETH for gas fees (if using Ethereum)
```

## 🎯 Integration with Ally Platform

This service is designed to be called by the Ally backend services for reward payout operations. The backend should:

1. Authenticate using the `SHADE_AGENT_TOKEN`
2. Call the appropriate endpoints for transaction execution
3. Monitor transaction status and handle errors appropriately

The service enables:
- Centralized spend caps and policy enforcement
- Ability to pause operations
- Audit trail for all transactions
- Secure custody management
