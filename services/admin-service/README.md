# Admin Service

The Admin Service provides a comprehensive backend API for managing the Ally platform, including user rankings, message scoring analysis, token campaigns, and payout management.

## Features

- **Authentication & Authorization**: JWT-based admin authentication
- **User Management**: View user rankings, trust scores, and engagement metrics
- **Message Analysis**: Browse scored messages with detailed breakdowns
- **Campaign Management**: Create and manage token reward campaigns
- **Payout Processing**: Handle reward distributions and blockchain transactions
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
- `GET /api/campaigns` - Get all campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/activate` - Activate campaign
- `POST /api/campaigns/:id/deactivate` - Deactivate campaign

### Payouts
- `GET /api/payouts` - Get all payouts with filtering
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

The admin service uses the following new database tables:

- **Admin**: Admin user accounts
- **Campaign**: Token reward campaigns
- **Payout**: Individual reward payouts
- **SystemConfig**: System configuration settings

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

## TODO

- [ ] Integrate with shade-agent service for actual blockchain transactions
- [ ] Add rate limiting
- [ ] Implement audit logging
- [ ] Add email notifications for payout status
- [ ] Create admin role management system
- [ ] Add bulk operations for payouts
- [ ] Implement data export functionality
