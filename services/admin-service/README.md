# Admin Service

The Admin Service provides a comprehensive backend API for managing the Ally platform, including user rankings, message scoring analysis, epoch-based token campaigns, and payout management.

## Features

- **Authentication & Authorization**: JWT-based admin authentication
- **User Management**: View user rankings, trust scores, and engagement metrics
- **Message Analysis**: Browse scored messages with detailed breakdowns
- **Epoch-Based Campaign Management**: Create and manage recurring token reward campaigns with automatic fund recycling
- **Epoch Management**: Manual epoch creation, state transitions, and fund tracking
- **Payout Processing**: Handle reward distributions linked to specific epochs
- **Analytics Dashboard**: System statistics and activity trends

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Create new admin account
- `GET /api/auth/me` - Get current admin info

### Users
- `GET /api/users/rankings` - Get user rankings with filtering
- `GET /api/users/:id` - Get detailed user information
- `GET /api/users/:id/messages` - Get user's messages with scores

### Messages
- `GET /api/messages` - Get scored messages with filtering
- `GET /api/messages/:id` - Get detailed message information
- `GET /api/messages/stats/summary` - Get message statistics

### Campaigns
- `GET /api/campaigns` - Get all campaigns with epoch-based filtering (status, isFunded, platform, search)
- `GET /api/campaigns/:id` - Get campaign details with epoch summary and statistics
- `POST /api/campaigns` - Create new epoch-based campaign (payoutIntervalSeconds, epochRewardCap, claimWindowSeconds, recycleUnclaimed)
- `PUT /api/campaigns/:id` - Update campaign (RBAC-guarded)
- `DELETE /api/campaigns/:id` - Delete campaign (soft delete by setting inactive)
- `POST /api/campaigns/:id/fund` - Fund campaign and set vault details (isFunded, vaultAddress, fundingTxHash, startDate)
- `POST /api/campaigns/:id/status` - Update campaign status (DRAFT|ACTIVE|PAUSED|COMPLETED|CANCELED)
- `POST /api/campaigns/:id/activate` - Activate campaign
- `POST /api/campaigns/:id/deactivate` - Deactivate campaign

### Epochs (Manual Management)
- `GET /api/epochs/campaigns/:campaignId/epochs` - List epochs for campaign with filtering (state, date range)
- `GET /api/epochs/:epochId` - Get epoch details with allocation/claimed amounts and payouts
- `POST /api/epochs/campaigns/:campaignId/epochs` - Manual create epoch (number, start/end, claimWindowEnds, allocated)
- `PUT /api/epochs/:epochId` - Manual updates (state, allocated, claimWindowEnds) with guards

### Payouts
- `GET /api/payouts` - Get all payouts with filtering (now supports epochId linking)
- `GET /api/payouts/:id` - Get payout details
- `POST /api/payouts/process` - Process multiple payouts
- `POST /api/payouts/:id/cancel` - Cancel a payout
- `GET /api/payouts/stats/summary` - Get payout statistics

### Statistics
- `GET /api/stats/overview` - System overview statistics
- `GET /api/stats/activity` - Activity trends over time
- `GET /api/stats/score-distribution` - Score distribution analysis
- `GET /api/stats/user-engagement` - User engagement metrics

## Configuration

Set these environment variables:

```env
# Required
ADMIN_PORT=8083
JWT_SECRET=your-super-secret-jwt-key
POSTGRES_URL=postgresql://ally:secret@postgres/allyhub

# Optional
JWT_EXPIRES_IN=24h
ADMIN_FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

## Database Schema

The admin service uses the following database tables:

- **Admin**: Admin user accounts
- **Campaign**: Epoch-based token reward campaigns with funding status and recurring payout configuration
- **CampaignEpoch**: Individual payout windows with allocation, claim tracking, and state management
- **Payout**: Individual reward payouts (now linked to specific epochs)
- **SystemConfig**: System configuration settings

### Epoch-Based Campaign System

Campaigns now support recurring payouts through epochs:

- **Campaign States**: DRAFT → ACTIVE → PAUSED → COMPLETED → CANCELED
- **Epoch States**: OPEN → CLAIMING → RECYCLED → EXPIRED → CLOSED
- **Fund Recycling**: Unclaimed rewards can be automatically recycled back to the campaign pool
- **Manual Management**: All epoch operations are manual (no automation in admin-service)

## Security

- JWT-based authentication with configurable expiration
- Password hashing with bcrypt (12 rounds)
- CORS protection
- Helmet security headers
- Input validation with Joi schemas

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Docker

```bash
# Build image
docker build -t ally-admin-service .

# Run container
docker run -p 8083:8083 \
  -e POSTGRES_URL=postgresql://ally:secret@host.docker.internal:5432/allyhub \
  -e JWT_SECRET=your-secret-key \
  ally-admin-service
```

## Integration

The admin service integrates with:

- **Database**: PostgreSQL via Prisma ORM
- **Shade Agent**: For blockchain transactions (TODO)
- **Frontend**: React admin dashboard (TODO)

## Example API Usage

### Create Epoch-Based Campaign
```bash
POST /api/campaigns
{
  "name": "Weekly Discord Rewards",
  "description": "Reward active Discord contributors weekly",
  "tokenSymbol": "ALLY",
  "isNative": true,
  "chainId": "near",
  "totalRewardPool": "1000000000000000000000", // 1000 tokens
  "payoutIntervalSeconds": 604800, // 1 week
  "epochRewardCap": "100000000000000000000", // 100 tokens per epoch
  "claimWindowSeconds": 604800, // 7 days to claim
  "recycleUnclaimed": true,
  "platforms": ["discord"]
}
```

### Fund Campaign
```bash
POST /api/campaigns/{id}/fund
{
  "vaultAddress": "0x123...",
  "fundingTxHash": "0xabc...",
  "startDate": "2024-01-01T00:00:00Z"
}
```

### Create Epoch
```bash
POST /api/epochs/campaigns/{id}/epochs
{
  "epochNumber": 1,
  "epochStart": "2024-01-01T00:00:00Z",
  "epochEnd": "2024-01-08T00:00:00Z",
  "claimWindowEnds": "2024-01-15T00:00:00Z",
  "allocated": "100000000000000000000"
}
```

## TODO

- [ ] Integrate with shade-agent service for actual blockchain transactions
- [ ] Add rate limiting
- [ ] Implement audit logging
- [ ] Add email notifications for payout status
- [ ] Create admin role management system
- [ ] Add bulk operations for payouts
- [ ] Implement data export functionality
- [ ] Add automated epoch creation service (external to admin-service)
- [ ] Add automated fund recycling service (external to admin-service)
