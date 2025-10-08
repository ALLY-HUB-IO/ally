# Shade Agent Funds Operator

The Shade Agent has been enhanced to function as a funds operator for the Ally platform, providing secure campaign wallet management and fund operations.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Service │───▶│   Shade Agent    │───▶│   Campaign      │
│                 │    │   (Funds Op)     │    │   Wallets       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌──────────────────┐    ┌──────────────────┐
                       │   Authentication │    │   Blockchain     │
                       │   Middleware     │    │   Networks       │
                       └──────────────────┘    └──────────────────┘
```

## 🔑 Key Features

### 1. **Unique Campaign Wallets**
- Generate deterministic wallet addresses based on campaign ID and chain
- Each campaign gets a unique wallet per blockchain network
- Wallets are derived using SHA-256 hashing for security

### 2. **Secure Communication**
- Token-based authentication between admin service and shade-agent
- All campaign wallet operations require valid authentication
- Timing-safe token comparison to prevent timing attacks

### 3. **Fund Management**
- Check funding status of campaign wallets
- Withdraw funds only for canceled campaigns
- Support for multiple blockchain networks

### 4. **Cross-Chain Support**
- Theta (mainnet/testnet)
- Ethereum (mainnet/testnet)
- Extensible to other EVM-compatible chains

## 🚀 API Endpoints

### Authentication
All campaign wallet endpoints require authentication via the `Authorization` header:
```
Authorization: Bearer <ADMIN_SHADE_AGENT_TOKEN>
```

### 1. Generate Campaign Wallet
**POST** `/api/campaign-wallet/generate`

Generate a new wallet for a campaign on a specific chain.

**Request Body:**
```json
{
  "campaignId": "campaign-123",
  "chain": "theta-365"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "chain": "theta-365",
    "campaignId": "campaign-123",
    "balance": "0",
    "isFunded": false
  }
}
```

### 2. Get Campaign Wallet
**GET** `/api/campaign-wallet/:campaignId/:chain`

Get existing wallet information for a campaign.

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "chain": "theta-365",
    "campaignId": "campaign-123",
    "balance": "1000000000000000000",
    "isFunded": true
  }
}
```

### 3. Check Funding Status
**GET** `/api/campaign-wallet/:campaignId/:chain/funding-status`

Check if a campaign wallet is funded.

**Response:**
```json
{
  "success": true,
  "data": {
    "isFunded": true,
    "balance": "1000000000000000000",
    "walletAddress": "0x..."
  }
}
```

### 4. Withdraw Funds
**POST** `/api/campaign-wallet/withdraw`

Withdraw funds from a campaign wallet (only for canceled campaigns).

**Request Body:**
```json
{
  "campaignId": "campaign-123",
  "chain": "theta-365",
  "recipientAddress": "0x1234567890123456789012345678901234567890",
  "amount": "500000000000000000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "txHash": "0x...",
    "message": "Withdrawal completed successfully",
    "amount": "500000000000000000",
    "recipientAddress": "0x1234567890123456789012345678901234567890",
    "campaignId": "campaign-123",
    "chain": "theta-365"
  }
}
```

## 🔧 Configuration

### Environment Variables

Add to your `infra/.env` file:

```bash
# Admin-Shade Agent Communication
ADMIN_SHADE_AGENT_TOKEN=your-admin-shade-agent-secret-token
```

Generate a secure token:
```bash
openssl rand -hex 32
```

### Required Dependencies

The funds operator functionality uses existing dependencies:
- `@neardefi/shade-agent-js` - For Chain Signature operations
- `ethers` - For blockchain interactions
- `chainsig.js` - For transaction signing
- `crypto` - For secure hashing and authentication

## 🛡️ Security Features

### 1. **Deterministic Wallet Generation**
- Uses SHA-256 hashing of campaign ID and chain
- Ensures consistent wallet addresses across service restarts
- Prevents wallet address collisions

### 2. **Authentication Middleware**
- Token-based authentication for all operations
- Timing-safe comparison to prevent timing attacks
- Secure token storage in environment variables

### 3. **Withdrawal Restrictions**
- Only allows withdrawals from funded wallets
- Validates recipient address format
- Checks sufficient balance before withdrawal

### 4. **Error Handling**
- Comprehensive error messages
- Secure error logging without exposing sensitive data
- Graceful failure handling

## 📋 Usage Examples

### 1. Admin Service Integration

```typescript
// Generate a campaign wallet
const response = await fetch('http://localhost:8090/api/campaign-wallet/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ADMIN_SHADE_AGENT_TOKEN}`
  },
  body: JSON.stringify({
    campaignId: 'campaign-123',
    chain: 'theta-365'
  })
});

const walletInfo = await response.json();
console.log('Campaign wallet:', walletInfo.data.walletAddress);
```

### 2. Check Funding Status

```typescript
const response = await fetch('http://localhost:8090/api/campaign-wallet/campaign-123/theta-365/funding-status', {
  headers: {
    'Authorization': `Bearer ${process.env.ADMIN_SHADE_AGENT_TOKEN}`
  }
});

const status = await response.json();
console.log('Is funded:', status.data.isFunded);
```

### 3. Withdraw Funds

```typescript
const response = await fetch('http://localhost:8090/api/campaign-wallet/withdraw', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ADMIN_SHADE_AGENT_TOKEN}`
  },
  body: JSON.stringify({
    campaignId: 'campaign-123',
    chain: 'theta-365',
    recipientAddress: '0x1234567890123456789012345678901234567890',
    amount: '1000000000000000000' // 1 TFUEL
  })
});

const result = await response.json();
console.log('Withdrawal tx:', result.data.txHash);
```

## 🔗 Chain Identifiers

Supported chain identifiers:
- `"theta-365"` - Theta testnet
- `"theta-361"` - Theta mainnet
- `"ethereum-1"` - Ethereum mainnet
- `"ethereum-11155111"` - Ethereum Sepolia testnet

## 🚨 Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "error": "Invalid authentication token"
}
```

**400 Bad Request:**
```json
{
  "error": "campaignId, chain, and recipientAddress are required"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to generate campaign wallet",
  "details": "Contract ID not configured"
}
```

## 🔄 Workflow

### Campaign Creation
1. Admin service calls `/api/campaign-wallet/generate`
2. Shade agent generates unique wallet address
3. Admin service stores wallet address with campaign
4. Campaign is ready for funding

### Campaign Funding
1. Users send funds to the campaign wallet address
2. Admin service can check funding status via `/api/campaign-wallet/:campaignId/:chain/funding-status`
3. Campaign becomes active when funded

### Campaign Cancellation & Withdrawal
1. Campaign is marked as canceled in admin service
2. Admin service calls `/api/campaign-wallet/withdraw`
3. Funds are returned to the original sender
4. Transaction hash is returned for tracking

## 🛠️ Development

### Local Testing

1. **Start the shade-agent service:**
```bash
cd services/shade-agent
npm run dev
```

2. **Test authentication:**
```bash
curl -H "Authorization: Bearer your-token" \
  http://localhost:8090/api/campaign-wallet/campaign-123/theta-365
```

3. **Generate a wallet:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"campaignId":"test-123","chain":"theta-365"}' \
  http://localhost:8090/api/campaign-wallet/generate
```

### Docker Deployment

The funds operator functionality is included in the existing Docker setup:

```bash
cd infra
docker compose up shade-agent
```

## 📊 Monitoring

### Health Checks
- Use existing health check endpoint: `GET /:healthz`
- Monitor authentication failures in logs
- Track withdrawal transaction success rates

### Logging
- All operations are logged with appropriate detail levels
- Authentication failures are logged for security monitoring
- Transaction hashes are logged for audit trails

## 🔮 Future Enhancements

1. **Multi-signature Support** - Require multiple signatures for large withdrawals
2. **Time-locked Withdrawals** - Implement withdrawal delays for security
3. **Campaign State Validation** - Integrate with campaign lifecycle management
4. **Advanced Analytics** - Track funding patterns and wallet usage
5. **Gas Optimization** - Implement gas price optimization for withdrawals

## 🆘 Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify `ADMIN_SHADE_AGENT_TOKEN` is set correctly
   - Check token format in Authorization header
   - Ensure token matches between admin service and shade-agent

2. **Wallet Generation Failures**
   - Verify `NEXT_PUBLIC_contractId` is configured
   - Check NEAR network connectivity
   - Ensure shade-agent-cli is running

3. **Withdrawal Failures**
   - Verify campaign wallet is funded
   - Check recipient address format
   - Ensure sufficient gas for transaction

4. **Chain Connectivity Issues**
   - Verify RPC URLs are accessible
   - Check network configuration
   - Test with different chain identifiers

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about wallet generation, authentication, and transaction processing.
