import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  Admin, 
  User, 
  Message, 
  Campaign, 
  Payout, 
  OverviewStats, 
  ActivityData,
  LeaderboardData,
  ApiResponse,
  PaginatedResponse,
  LoginForm,
  CampaignForm
} from '../types';

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:8083/api',
      timeout: 10000,
    });

    // Load token from localStorage
    this.token = localStorage.getItem('admin_token');
    if (this.token) {
      this.setAuthToken(this.token);
    }

    // Add response interceptor to handle token expiration
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  private setAuthToken(token: string) {
    this.token = token;
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('admin_token', token);
  }

  private clearAuthToken() {
    this.token = null;
    delete this.api.defaults.headers.common['Authorization'];
    localStorage.removeItem('admin_token');
  }

  // Authentication
  async login(credentials: LoginForm): Promise<{ token: string; admin: Admin }> {
    const response: AxiosResponse<{ ok: boolean; token: string; admin: Admin; error?: string }> = 
      await this.api.post('/auth/login', credentials);
    
    if (response.data.ok && response.data.token) {
      this.setAuthToken(response.data.token);
      return {
        token: response.data.token,
        admin: response.data.admin
      };
    }
    throw new Error(response.data.error || 'Login failed');
  }

  async register(adminData: { email: string; name: string; password: string }): Promise<Admin> {
    const response: AxiosResponse<{ ok: boolean; admin: Admin; message?: string; error?: string }> = 
      await this.api.post('/auth/register', adminData);
    
    if (response.data.ok && response.data.admin) {
      return response.data.admin;
    }
    throw new Error(response.data.error || 'Registration failed');
  }

  async getCurrentAdmin(): Promise<Admin> {
    const response: AxiosResponse<{ ok: boolean; admin: Admin; error?: string }> = 
      await this.api.get('/auth/me');
    
    if (response.data.ok && response.data.admin) {
      return response.data.admin;
    }
    throw new Error(response.data.error || 'Failed to get admin info');
  }

  logout() {
    this.clearAuthToken();
    window.location.href = '/login';
  }

  // Users
  async getUsers(params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    minTrust?: number;
    maxTrust?: number;
  }): Promise<PaginatedResponse<User>> {
    const response: AxiosResponse<PaginatedResponse<User>> = 
      await this.api.get('/users/rankings', { params });
    return response.data;
  }

  async getUser(id: string): Promise<User> {
    const response: AxiosResponse<ApiResponse<User>> = 
      await this.api.get(`/users/${id}`);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get user');
  }

  async getUserMessages(id: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Message>> {
    const response: AxiosResponse<PaginatedResponse<Message>> = 
      await this.api.get(`/users/${id}/messages`, { params });
    return response.data;
  }

  // Messages
  async getMessages(params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    minScore?: number;
    maxScore?: number;
    platform?: string;
    projectId?: string;
    authorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<Message>> {
    const response: AxiosResponse<PaginatedResponse<Message>> = 
      await this.api.get('/messages', { params });
    return response.data;
  }

  async getMessage(id: string): Promise<Message> {
    const response: AxiosResponse<ApiResponse<Message>> = 
      await this.api.get(`/messages/${id}`);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get message');
  }

  async getMessageStats(): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.api.get('/messages/stats/summary');
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get message stats');
  }

  // Live feed for real-time message updates
  async getLiveFeed(params?: {
    limit?: number;
    since?: string;
  }): Promise<{ data: Message[]; meta: any }> {
    const response: AxiosResponse<ApiResponse<Message[]>> = 
      await this.api.get('/messages/live-feed', { params });
    
    if (response.data.ok && response.data.data) {
      // Backend returns { ok: true, data: [...messages], meta: {...} }
      // We need to restructure it to match the expected format
      return {
        data: response.data.data,
        meta: (response.data as any).meta || {}
      };
    }
    throw new Error(response.data.error || 'Failed to get live feed');
  }

  // Campaigns
  async getCampaigns(params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isActive?: boolean;
    isNative?: boolean;
    chainId?: string;
    platforms?: string;
    search?: string;
  }): Promise<PaginatedResponse<Campaign>> {
    const response: AxiosResponse<PaginatedResponse<Campaign>> = 
      await this.api.get('/campaigns', { params });
    return response.data;
  }

  async getCampaign(id: string): Promise<Campaign> {
    const response: AxiosResponse<ApiResponse<Campaign>> = 
      await this.api.get(`/campaigns/${id}`);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get campaign');
  }

  async createCampaign(campaign: CampaignForm): Promise<Campaign> {
    const response: AxiosResponse<ApiResponse<Campaign>> = 
      await this.api.post('/campaigns', campaign);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create campaign');
  }

  async updateCampaign(id: string, campaign: Partial<CampaignForm>): Promise<Campaign> {
    const response: AxiosResponse<ApiResponse<Campaign>> = 
      await this.api.put(`/campaigns/${id}`, campaign);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update campaign');
  }

  async deleteCampaign(id: string): Promise<void> {
    const response: AxiosResponse<ApiResponse<void>> = 
      await this.api.delete(`/campaigns/${id}`);
    
    if (!response.data.ok) {
      throw new Error(response.data.error || 'Failed to delete campaign');
    }
  }

  async activateCampaign(id: string): Promise<Campaign> {
    const response: AxiosResponse<ApiResponse<Campaign>> = 
      await this.api.post(`/campaigns/${id}/activate`);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to activate campaign');
  }

  async deactivateCampaign(id: string): Promise<Campaign> {
    const response: AxiosResponse<ApiResponse<Campaign>> = 
      await this.api.post(`/campaigns/${id}/deactivate`);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to deactivate campaign');
  }

  // Payouts
  async getPayouts(params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: string;
    campaignId?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<Payout>> {
    const response: AxiosResponse<PaginatedResponse<Payout>> = 
      await this.api.get('/payouts', { params });
    return response.data;
  }

  async getPayout(id: string): Promise<Payout> {
    const response: AxiosResponse<ApiResponse<Payout>> = 
      await this.api.get(`/payouts/${id}`);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get payout');
  }

  async processPayouts(payoutIds: string[]): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.api.post('/payouts/process', { payoutIds });
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to process payouts');
  }

  async cancelPayout(id: string): Promise<Payout> {
    const response: AxiosResponse<ApiResponse<Payout>> = 
      await this.api.post(`/payouts/${id}/cancel`);
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to cancel payout');
  }

  async getPayoutStats(): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.api.get('/payouts/stats/summary');
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get payout stats');
  }

  // Statistics
  async getOverviewStats(): Promise<OverviewStats> {
    const response: AxiosResponse<ApiResponse<OverviewStats>> = 
      await this.api.get('/stats/overview');
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get overview stats');
  }

  async getActivityStats(params?: {
    period?: string;
    granularity?: string;
  }): Promise<ActivityData> {
    const response: AxiosResponse<ApiResponse<ActivityData>> = 
      await this.api.get('/stats/activity', { params });
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get activity stats');
  }

  async getScoreDistribution(): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.api.get('/stats/score-distribution');
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get score distribution');
  }

  async getUserEngagement(): Promise<any> {
    const response: AxiosResponse<ApiResponse<any>> = 
      await this.api.get('/stats/user-engagement');
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get user engagement');
  }

  async getLeaderboard(): Promise<LeaderboardData> {
    const response: AxiosResponse<ApiResponse<LeaderboardData>> = 
      await this.api.get('/stats/leaderboard');
    
    if (response.data.ok && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get leaderboard');
  }

  async getCriticalMessages(): Promise<{ data: Message[]; count: number }> {
    const response = await this.api.get('/messages/critical');
    if (response.data.ok) {
      return {
        data: response.data.data,
        count: response.data.count
      };
    }
    throw new Error(response.data.error || 'Failed to get critical messages');
  }
}

export const apiService = new ApiService();
