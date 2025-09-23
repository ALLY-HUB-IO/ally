import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Button,
} from '@mui/material';
import {
  People as PeopleIcon,
  Message as MessageIcon,
  Campaign as CampaignIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as AttachMoneyIcon,
  Psychology as PsychologyIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { OverviewStats } from '../types';
import { apiService } from '../services/api';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  gradient?: boolean;
}> = ({ title, value, subtitle, icon, color, gradient = false }) => (
  <Card
    sx={{
      background: gradient 
        ? 'linear-gradient(135deg, #7B2CBF 0%, #9D4EDD 100%)'
        : '#FFFFFF',
      color: gradient ? 'white' : 'inherit',
      height: '100%',
      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: gradient ? 'rgba(255,255,255,0.8)' : '#718096',
              fontWeight: 500,
              mb: 0.5,
            }}
          >
            {title}
          </Typography>
          <Typography 
            variant="h3" 
            component="div" 
            sx={{ 
              fontWeight: 700,
              color: gradient ? 'white' : '#2D3748',
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>
          {subtitle && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: gradient ? 'rgba(255,255,255,0.7)' : '#718096',
                mt: 0.5,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: gradient ? 'rgba(255,255,255,0.2)' : color,
            borderRadius: '12px',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
          }}
        >
          {React.cloneElement(icon as React.ReactElement, { 
            sx: { 
              color: gradient ? 'white' : 'white',
              fontSize: '1.5rem',
            } 
          })}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// Mock data for demonstration
const getMockStats = (): OverviewStats => ({
  users: {
    total: 1250,
    averageTrust: 0.75,
    minTrust: 0.1,
    maxTrust: 0.95,
    recent: 45
  },
  messages: {
    total: 5400,
    recent: 234
  },
  interactions: {
    total: 5400,
    averageScore: 0.82,
    minScore: 0.1,
    maxScore: 0.98,
    recent: 234
  },
  campaigns: {
    total: 3,
    totalRewardPool: "1250000000000000000000" // 1250 tokens in wei
  },
  payouts: {
    total: 156,
    totalAmount: "850000000000000000000", // 850 tokens in wei
    recent: 12
  }
});

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('Attempting to fetch stats from API...');
        const data = await apiService.getOverviewStats();
        console.log('API data received:', data);
        setStats(data);
        setIsUsingMockData(false);
      } catch (err) {
        console.log('API not available or failed, using example data:', err);
        // Always use mock data when API fails
        setStats(getMockStats());
        setIsUsingMockData(true);
      } finally {
        setLoading(false);
      }
    };

    // Add a timeout to ensure we don't wait too long for API
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('API timeout, using example data');
        setStats(getMockStats());
        setIsUsingMockData(true);
        setLoading(false);
      }
    }, 3000); // 3 second timeout

    fetchStats();

    return () => clearTimeout(timeoutId);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    // Final fallback - use mock data if somehow stats is still null
    console.log('Stats is null, using fallback mock data');
    const fallbackStats = getMockStats();
    return <DashboardContent stats={fallbackStats} isExampleData={true} />;
  }

  return <DashboardContent stats={stats} isExampleData={isUsingMockData} />;
};

// Dashboard content component that can be reused with mock data
const DashboardContent: React.FC<{ stats: OverviewStats; isExampleData?: boolean }> = ({ stats, isExampleData = false }) => {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h2" sx={{ fontWeight: 700, color: '#2D3748' }}>
            Project Dashboard
          </Typography>
          {isExampleData && (
            <Chip 
              label="Example Data" 
              size="small" 
              sx={{ 
                backgroundColor: '#F59E0B', 
                color: 'white', 
                fontWeight: 500,
                fontSize: '0.75rem'
              }} 
            />
          )}
        </Box>
        <Typography variant="body1" sx={{ color: '#718096' }}>
          Monitor your platform performance and user engagement
        </Typography>
      </Box>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="This Month's Marketing Budget"
            value={`$${(parseInt(stats.payouts.totalAmount) / 1e18 * 15).toLocaleString()}`}
            subtitle="Payments to social media influencers"
            icon={<AttachMoneyIcon />}
            color="#3B82F6"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Top Platform"
            value="X"
            subtitle="by Interaction Count"
            icon={<TrendingUpIcon />}
            color="#10B981"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Interactions"
            value={stats.interactions.total.toLocaleString()}
            subtitle="Across all platforms"
            icon={<SpeedIcon />}
            color="#F59E0B"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Overall Sentiment"
            value="Positive"
            subtitle={`${Math.round(stats.interactions.averageScore * 100)}% Positive Mentions`}
            icon={<PsychologyIcon />}
            color="#7B2CBF"
            gradient={true}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Left Column - Influencer Leaderboard */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2D3748', mb: 3 }}>
                Influencer Leaderboard
              </Typography>
              
              <Box sx={{ overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, mb: 2, pb: 1, borderBottom: '1px solid #E2E8F0' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    INFLUENCER
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    PLATFORM
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    INTERACTIONS
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    POINTS
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    % OF TOTAL
                  </Typography>
                </Box>
                
                {[
                  { name: 'Sophia Carter', platform: 'X', interactions: '1,500', points: '7,500', percentage: '25%' },
                  { name: 'Ethan Bennett', platform: 'Telegram', interactions: '1,200', points: '6,000', percentage: '20%' },
                  { name: 'Olivia Hayes', platform: 'Discord', interactions: '1,000', points: '5,000', percentage: '17%' },
                  { name: 'Liam Foster', platform: 'X', interactions: '900', points: '4,500', percentage: '15%' },
                  { name: 'Ava Morgan', platform: 'Telegram', interactions: '800', points: '4,000', percentage: '13%' },
                ].map((influencer, index) => (
                  <Box key={index} sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, py: 2, borderBottom: index < 4 ? '1px solid #F1F5F9' : 'none' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#2D3748' }}>
                      {influencer.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#718096' }}>
                      {influencer.platform}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#2D3748' }}>
                      {influencer.interactions}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#2D3748' }}>
                      {influencer.points}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#2D3748' }}>
                      {influencer.percentage}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Live Update Feed */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#2D3748', mb: 3 }}>
                Live Update Feed
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { 
                    icon: '🐦', 
                    title: 'Post analyzed: Positive sentiment', 
                    description: 'New partnership announcement by @Sarah_Johnson', 
                    time: '2 minutes ago',
                    sentiment: 'Positive',
                    score: '0.85'
                  },
                  { 
                    icon: '✈️', 
                    title: 'Campaign feedback processed', 
                    description: 'User engagement in Telegram group analyzed', 
                    time: '15 minutes ago',
                    sentiment: 'Neutral',
                    score: '0.62'
                  },
                  { 
                    icon: '💬', 
                    title: 'Community post scored', 
                    description: 'Discord #general channel activity analyzed', 
                    time: '28 minutes ago',
                    sentiment: 'Positive',
                    score: '0.78'
                  },
                  { 
                    icon: '🐦', 
                    title: 'High-value post detected', 
                    description: 'Feature announcement by @Liam_Foster', 
                    time: '45 minutes ago',
                    sentiment: 'Positive',
                    score: '0.92'
                  },
                ].map((update, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 2, pb: 2, borderBottom: index < 3 ? '1px solid #F1F5F9' : 'none' }}>
                    <Box sx={{ fontSize: '1.5rem', flexShrink: 0 }}>
                      {update.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2D3748' }}>
                          {update.title}
                        </Typography>
                        <Chip 
                          label={update.sentiment} 
                          size="small" 
                          sx={{ 
                            backgroundColor: update.sentiment === 'Positive' ? '#10B981' : '#F59E0B', 
                            color: 'white', 
                            fontWeight: 500,
                            fontSize: '0.65rem',
                            height: 20,
                            '& .MuiChip-label': { px: 1 }
                          }} 
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                        {update.description}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#A0AEC0' }}>
                          {update.time}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#7B2CBF', fontWeight: 600 }}>
                          Score: {update.score}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Section - Top Posts and Critical Posts */}
      <Grid container spacing={3} sx={{ mt: 0 }}>
        {/* Top Posts Section */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#2D3748' }}>
                  Top Posts (Last 24h)
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#7B2CBF', 
                    fontWeight: 600, 
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  View all
                </Typography>
              </Box>
              
              <Box sx={{ overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 2, mb: 2, pb: 1, borderBottom: '1px solid #E2E8F0' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    POST
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    SENTIMENT
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    VALUE
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    REACH
                  </Typography>
                </Box>
                
                {[
                  { 
                    post: 'Excited to announce our new partnership! #Social... on X', 
                    sentiment: { label: 'Positive', color: '#10B981' }, 
                    value: { label: 'High', color: '#3B82F6' }, 
                    reach: '10k' 
                  },
                  { 
                    post: 'Check out our latest campaign results. Link in bio! on Telegram', 
                    sentiment: { label: 'Neutral', color: '#F59E0B' }, 
                    value: { label: 'Medium', color: '#F59E0B' }, 
                    reach: '5k' 
                  },
                  { 
                    post: 'Join our community for exclusive content and upd... on Discord', 
                    sentiment: { label: 'Positive', color: '#10B981' }, 
                    value: { label: 'Medium', color: '#F59E0B' }, 
                    reach: '3k' 
                  },
                ].map((item, index) => (
                  <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 2, py: 2, borderBottom: index < 2 ? '1px solid #F1F5F9' : 'none' }}>
                    <Typography variant="body2" sx={{ color: '#2D3748', lineHeight: 1.4 }}>
                      {item.post}
                    </Typography>
                    <Chip 
                      label={item.sentiment.label} 
                      size="small" 
                      sx={{ 
                        backgroundColor: item.sentiment.color, 
                        color: 'white', 
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        height: 24,
                        '& .MuiChip-label': { px: 1.5 }
                      }} 
                    />
                    <Chip 
                      label={item.value.label} 
                      size="small" 
                      sx={{ 
                        backgroundColor: item.value.color, 
                        color: 'white', 
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        height: 24,
                        '& .MuiChip-label': { px: 1.5 }
                      }} 
                    />
                    <Typography variant="body2" sx={{ color: '#2D3748', fontWeight: 500 }}>
                      {item.reach}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Critical Posts Section */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#2D3748' }}>
                  Review Critical Posts
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#EF4444', 
                    fontWeight: 600,
                    backgroundColor: '#FEF2F2',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem'
                  }}
                >
                  3 items need attention
                </Typography>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#EF4444', 
                    fontWeight: 500, 
                    mb: 1,
                    lineHeight: 1.4
                  }}
                >
                  "This is unacceptable! #CustomerService"
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#718096',
                    display: 'block',
                    mb: 2
                  }}
                >
                  on X, Reach: 15k
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  sx={{
                    backgroundColor: '#7B2CBF',
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2,
                    py: 0.5,
                    '&:hover': {
                      backgroundColor: '#5A189A',
                    },
                  }}
                >
                  Review
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
