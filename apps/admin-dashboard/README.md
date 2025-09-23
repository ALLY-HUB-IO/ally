# Ally Admin Dashboard

A React-based admin interface for managing the Ally platform, including user rankings, message scoring analysis, token campaigns, and payout management.

## Features

- **Dashboard Overview**: System statistics and activity metrics
- **User Management**: View user rankings, trust scores, and engagement metrics
- **Message Analysis**: Browse scored messages with detailed breakdowns and filtering
- **Campaign Management**: Create and manage token reward campaigns
- **Payout Processing**: Handle reward distributions and blockchain transactions
- **Authentication**: Secure admin login with JWT tokens

## Technology Stack

- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **React Router** for navigation
- **Axios** for API communication
- **Recharts** for data visualization

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Ally admin service running on port 8083

### Installation

```bash
# Install dependencies
npm install

# Start development server
NODE_OPTIONS=--openssl-legacy-provider npm start
```

The app will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_API_URL=http://localhost:8083/api
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx      # Main layout with navigation
│   └── ProtectedRoute.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state management
├── pages/              # Page components
│   ├── DashboardPage.tsx
│   ├── UsersPage.tsx
│   ├── MessagesPage.tsx
│   ├── CampaignsPage.tsx
│   ├── PayoutsPage.tsx
│   └── LoginPage.tsx
├── services/           # API services
│   └── api.ts         # API client
├── types/              # TypeScript type definitions
│   └── index.ts
├── App.tsx             # Main app component
└── index.tsx           # Entry point
```

## Features Overview

### Dashboard
- System overview with key metrics
- User, message, campaign, and payout statistics
- Recent activity indicators

### User Rankings
- Sortable user list with trust scores
- Search and filter functionality
- User engagement metrics
- Recent activity tracking

### Message Analysis
- Scored messages with detailed breakdowns
- Expandable message details
- Score distribution and rationale
- Platform and date filtering

### Campaign Management
- Create and edit token reward campaigns
- Set reward pools and time periods
- Activate/deactivate campaigns
- Track payout statistics

### Payout Processing
- View all payouts with status tracking
- Bulk payout processing
- Transaction hash tracking
- Error handling and retry logic

## API Integration

The dashboard communicates with the Ally admin service API:

- **Authentication**: JWT-based login/logout
- **Users**: User rankings and statistics
- **Messages**: Scored message analysis
- **Campaigns**: Campaign CRUD operations
- **Payouts**: Payout management and processing
- **Statistics**: System metrics and analytics

## Security

- JWT token authentication
- Protected routes
- Automatic token refresh
- Secure API communication

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

### Code Style

- TypeScript for type safety
- Material-UI components for consistency
- Functional components with hooks
- Error boundaries for error handling

## Deployment

### Production Build

```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

### Environment Configuration

For production deployment, update the API URL:

```env
REACT_APP_API_URL=https://your-admin-api-domain.com/api
```

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Test API integration thoroughly
4. Update documentation for new features

## License

This project is part of the Ally platform and follows the same licensing terms.
