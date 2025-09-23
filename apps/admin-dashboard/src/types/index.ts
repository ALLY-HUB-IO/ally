// Admin types
export interface Admin {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

// User types
export interface User {
  id: string;
  identity: string;
  displayName?: string;
  trust: number;
  createdAt: string;
  updatedAt: string;
  totalMessages: number;
  totalScores: number;
  totalReactions: number;
  avgScore: number;
  recentMessages: number;
}

// Message types
export interface Message {
  id: string;
  externalId?: string;
  content: string;
  author?: User;
  platform: string;
  projectId: string;
  score: number;
  rationale: string;
  createdAt: string;
  updatedAt?: string;
  scores: Score[];
  reactions: Reaction[];
  scoreBreakdown: Record<string, number>;
}

export interface Score {
  id: string;
  kind: string;
  value: number;
  source: string;
  createdAt: string;
}

export interface Reaction {
  id: string;
  kind: string;
  weight?: number;
  user: User;
  createdAt: string;
}

// Campaign types
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  tokenSymbol: string;
  tokenAddress?: string;
  totalRewardPool: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  minScore?: number;
  maxRewardPerUser?: string;
  createdBy: Admin;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalPayouts: number;
    completedPayouts: number;
    totalPayoutAmount: string;
    remainingAmount: string;
  };
}

// Payout types
export interface Payout {
  id: string;
  userId: string;
  campaignId: string;
  amount: string;
  status: PayoutStatus;
  txHash?: string;
  errorMessage?: string;
  campaign: {
    id: string;
    name: string;
    tokenSymbol: string;
    tokenAddress?: string;
  };
  processedBy?: Admin;
  createdAt: string;
  updatedAt: string;
}

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// API Response types
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  ok: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Statistics types
export interface OverviewStats {
  users: {
    total: number;
    averageTrust: number;
    minTrust: number;
    maxTrust: number;
    recent: number;
  };
  messages: {
    total: number;
    recent: number;
  };
  interactions: {
    total: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
    recent: number;
  };
  campaigns: {
    total: number;
    totalRewardPool: string;
  };
  payouts: {
    total: number;
    totalAmount: string;
    recent: number;
  };
}

export interface ActivityData {
  period: string;
  granularity: string;
  startDate: string;
  endDate: string;
  activity: {
    users: Array<{ period: string; count: number }>;
    messages: Array<{ period: string; count: number }>;
    interactions: Array<{ period: string; count: number; avg_score: number }>;
  };
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface CampaignForm {
  name: string;
  description?: string;
  tokenSymbol: string;
  tokenAddress?: string;
  totalRewardPool: string;
  startDate: string;
  endDate: string;
  minScore?: number;
  maxRewardPerUser?: string;
}
