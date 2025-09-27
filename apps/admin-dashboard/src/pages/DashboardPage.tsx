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
  Button,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AttachMoney as AttachMoneyIcon,
  Psychology as PsychologyIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { OverviewStats, LeaderboardData } from '../types';
import { apiService } from '../services/api';
import { LiveFeed } from '../components/LiveFeed';
import ReviewModal from '../components/ReviewModal';

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

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('Fetching stats from API...');
        const data = await apiService.getOverviewStats();
        console.log('API data received:', data);
        setStats(data);
        setError('');
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Failed to load dashboard data
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Alert severity="warning">
          No data available
        </Alert>
      </Box>
    );
  }

  return <DashboardContent stats={stats} />;
};

// Dashboard content component
const DashboardContent: React.FC<{ stats: OverviewStats }> = ({ stats }) => {
  const [topMessages, setTopMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [criticalMessages, setCriticalMessages] = useState<any[]>([]);
  const [loadingCritical, setLoadingCritical] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);

  useEffect(() => {
    const fetchTopMessages = async () => {
      try {
        // Get messages from the last 24 hours with highest scores
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const response = await apiService.getMessages({
          page: 1,
          limit: 5,
          sortBy: 'score',
          sortOrder: 'desc',
          dateFrom: yesterday.toISOString()
        });
        setTopMessages(response.data);
      } catch (err) {
        console.error('Failed to fetch top messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    const fetchLeaderboard = async () => {
      try {
        const data = await apiService.getLeaderboard();
        setLeaderboardData(data);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoadingLeaderboard(false);
      }
    };

    const fetchCriticalMessages = async () => {
      try {
        const response = await apiService.getCriticalMessages();
        setCriticalMessages(response.data);
      } catch (err) {
        console.error('Failed to fetch critical messages:', err);
        setCriticalMessages([]);
      } finally {
        setLoadingCritical(false);
      }
    };

    fetchTopMessages();
    fetchLeaderboard();
    fetchCriticalMessages();
  }, []);

  const handleOpenReviewModal = (message: any) => {
    setSelectedMessage(message);
    setReviewModalOpen(true);
  };

  const handleCloseReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedMessage(null);
  };
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h2" sx={{ fontWeight: 700, color: '#2D3748' }}>
            Project Dashboard
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: '#718096' }}>
          Monitor your platform performance and user engagement
        </Typography>
      </Box>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="This Month's Marketing Budget"
            value={`$${(parseInt(stats.thisMonthBudget || '0') / 1e18 * 15).toLocaleString()}`}
            subtitle="Active campaign budget"
            icon={<AttachMoneyIcon />}
            color="#3B82F6"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Top Platform"
            value={stats.topPlatform || "None"}
            subtitle="by Interaction Count"
            icon={<TrendingUpIcon />}
            color="#10B981"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Interactions"
            value={(stats.totalInteractions || stats.interactions.total).toLocaleString()}
            subtitle="Across all platforms"
            icon={<SpeedIcon />}
            color="#F59E0B"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Overall Sentiment"
            value={stats.sentiment24h?.positive && stats.sentiment24h.positive > 50 ? "Positive" : stats.sentiment24h?.negative && stats.sentiment24h.negative > 50 ? "Negative" : "Neutral"}
            subtitle={stats.sentiment24h ? `${stats.sentiment24h.positive}% Positive (24h)` : "No recent data"}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#2D3748' }}>
                  Influencer Leaderboard
                </Typography>
                {leaderboardData && (
                  <Typography variant="caption" sx={{ color: '#718096' }}>
                    Last updated: {new Date(leaderboardData.lastUpdated).toLocaleTimeString()}
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, mb: 2, pb: 1, borderBottom: '1px solid #E2E8F0' }}>
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
                    AVG SENTIMENT
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    POINTS
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    % OF TOTAL
                  </Typography>
                </Box>
                
                {loadingLeaderboard ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : leaderboardData && leaderboardData.leaderboard.length > 0 ? (
                  leaderboardData.leaderboard.map((influencer, index) => {
                    const getSentimentColor = (score: number | null) => {
                      if (score === null) return '#718096';
                      if (score >= 0.8) return '#10B981'; // Green - Very Positive
                      if (score >= 0.6) return '#84CC16'; // Light Green - Positive
                      if (score >= 0.4) return '#F59E0B'; // Yellow - Neutral
                      if (score >= 0.2) return '#F97316'; // Orange - Negative
                      return '#EF4444'; // Red - Very Negative
                    };

                    const getSentimentLabel = (score: number | null) => {
                      if (score === null) return 'N/A';
                      if (score >= 0.8) return 'Very Positive';
                      if (score >= 0.6) return 'Positive';
                      if (score >= 0.4) return 'Neutral';
                      if (score >= 0.2) return 'Negative';
                      return 'Very Negative';
                    };

                    return (
                      <Box key={influencer.userId} sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, py: 2, borderBottom: index < leaderboardData.leaderboard.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#2D3748' }}>
                          {influencer.userName}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#718096' }}>
                          {influencer.platform}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#2D3748' }}>
                          {influencer.interactions.toLocaleString()}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ color: getSentimentColor(influencer.averageSentiment) }}>
                            {influencer.averageSentiment ? influencer.averageSentiment.toFixed(3) : 'N/A'}
                          </Typography>
                          {influencer.averageSentiment && (
                            <Chip 
                              label={getSentimentLabel(influencer.averageSentiment)} 
                              size="small" 
                              sx={{ 
                                backgroundColor: getSentimentColor(influencer.averageSentiment), 
                                color: 'white', 
                                fontWeight: 500,
                                fontSize: '0.65rem',
                                height: 20,
                                '& .MuiChip-label': { px: 1 }
                              }} 
                            />
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ color: '#2D3748' }}>
                          {influencer.points ? influencer.points.toLocaleString() : 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#2D3748' }}>
                          {influencer.percentageOfTotal.toFixed(1)}%
                        </Typography>
                      </Box>
                    );
                  })
                ) : (
                  <Typography variant="body2" sx={{ color: '#718096', textAlign: 'center', py: 2 }}>
                    No leaderboard data available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Live Update Feed */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <LiveFeed 
                limit={8} 
                refreshInterval={5000}
              />
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
                <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 2, mb: 2, pb: 1, borderBottom: '1px solid #E2E8F0' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    POST
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    PLATFORM
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    SENTIMENT
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    VALUE
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    SCORE
                  </Typography>
                </Box>
                
                {loadingMessages ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <CircularProgress size={24} />
                  </Box>
                ) : topMessages.length > 0 ? topMessages.map((message, index) => {
                  // Extract sentiment and value scores from details if available
                  const sentimentScore = message.scores && message.scores.length > 0 && message.scores[0].details?.sentiment?.score 
                    ? message.scores[0].details.sentiment.score 
                    : message.score; // fallback to overall score
                  
                  const valueScore = message.scores && message.scores.length > 0 && message.scores[0].details?.value?.score 
                    ? message.scores[0].details.value.score 
                    : message.score; // fallback to overall score

                  const getSentimentColor = (score: number) => {
                    if (score >= 0.8) return '#10B981';
                    if (score >= 0.6) return '#84CC16';
                    if (score >= 0.4) return '#F59E0B';
                    if (score >= 0.2) return '#F97316';
                    return '#EF4444';
                  };
                  
                  const getSentimentLabel = (score: number) => {
                    if (score >= 0.8) return 'Very Positive';
                    if (score >= 0.6) return 'Positive';
                    if (score >= 0.4) return 'Neutral';
                    if (score >= 0.2) return 'Negative';
                    return 'Very Negative';
                  };
                  
                  const getValueLabel = (score: number) => {
                    if (score >= 0.8) return 'High';
                    if (score >= 0.6) return 'Medium-High';
                    if (score >= 0.4) return 'Medium';
                    if (score >= 0.2) return 'Low';
                    return 'Very Low';
                  };
                  
                  const getValueColor = (score: number) => {
                    if (score >= 0.8) return '#3B82F6';
                    if (score >= 0.6) return '#06B6D4';
                    if (score >= 0.4) return '#F59E0B';
                    if (score >= 0.2) return '#F97316';
                    return '#EF4444';
                  };

                  return (
                  <Box key={message.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 2, py: 2, borderBottom: index < topMessages.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <Typography variant="body2" sx={{ color: '#2D3748', lineHeight: 1.4 }}>
                      {message.content.length > 50 ? `${message.content.substring(0, 50)}...` : message.content}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#718096', textTransform: 'capitalize' }}>
                      {message.platform}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ color: getSentimentColor(sentimentScore), fontWeight: 500 }}>
                        {sentimentScore.toFixed(3)}
                      </Typography>
                      <Chip 
                        label={getSentimentLabel(sentimentScore)} 
                        size="small" 
                        sx={{ 
                          backgroundColor: getSentimentColor(sentimentScore), 
                          color: 'white', 
                          fontWeight: 500,
                          fontSize: '0.65rem',
                          height: 20,
                          '& .MuiChip-label': { px: 1 }
                        }} 
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ color: getValueColor(valueScore), fontWeight: 500 }}>
                        {valueScore.toFixed(3)}
                      </Typography>
                      <Chip 
                        label={getValueLabel(valueScore)} 
                        size="small" 
                        sx={{ 
                          backgroundColor: getValueColor(valueScore), 
                          color: 'white', 
                          fontWeight: 500,
                          fontSize: '0.65rem',
                          height: 20,
                          '& .MuiChip-label': { px: 1 }
                        }} 
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#2D3748', fontWeight: 600 }}>
                      {message.score.toFixed(3)}
                    </Typography>
                  </Box>
                  );
                }) : (
                  <Typography variant="body2" sx={{ color: '#718096', textAlign: 'center', py: 2 }}>
                    No messages found
                  </Typography>
                )}
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
                {!loadingCritical && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: criticalMessages.length > 0 ? '#EF4444' : '#10B981', 
                      fontWeight: 600,
                      backgroundColor: criticalMessages.length > 0 ? '#FEF2F2' : '#F0FDF4',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem'
                    }}
                  >
                    {criticalMessages.length} {criticalMessages.length === 1 ? 'item' : 'items'} need attention
                  </Typography>
                )}
              </Box>
              
              {loadingCritical ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : criticalMessages.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {criticalMessages.map((message, index) => {
                    const getSeverityColor = (score: number) => {
                      if (score < 0.1) return '#DC2626'; // Very critical
                      if (score < 0.2) return '#EA580C'; // Critical
                      return '#D97706'; // Moderate
                    };

                    const getSeverityLabel = (score: number) => {
                      if (score < 0.1) return 'Very Critical';
                      if (score < 0.2) return 'Critical';
                      return 'Moderate';
                    };

                    return (
                      <Box key={message.id} sx={{ 
                        p: 2, 
                        border: '1px solid #FEE2E2', 
                        borderRadius: 2, 
                        backgroundColor: '#FEFEFE' 
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: '#374151', 
                              fontWeight: 500, 
                              lineHeight: 1.4,
                              flex: 1,
                              mr: 1
                            }}
                          >
                            "{message.content.length > 80 ? `${message.content.substring(0, 80)}...` : message.content}"
                          </Typography>
                          <Chip
                            label={getSeverityLabel(message.score)}
                            size="small"
                            sx={{
                              backgroundColor: getSeverityColor(message.score),
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.65rem',
                              height: 20,
                              '& .MuiChip-label': { px: 1 }
                            }}
                          />
                        </Box>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: '#718096',
                            display: 'block',
                            mb: 1
                          }}
                        >
                          on {message.platform} • Score: {message.score.toFixed(3)} • {new Date(message.createdAt).toLocaleTimeString()}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleOpenReviewModal(message)}
                            sx={{
                              backgroundColor: '#7B2CBF',
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                              px: 2,
                              py: 0.5,
                              fontSize: '0.75rem',
                              '&:hover': {
                                backgroundColor: '#5A189A',
                              },
                            }}
                          >
                            Review
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{
                              borderColor: '#D1D5DB',
                              color: '#6B7280',
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 500,
                              px: 2,
                              py: 0.5,
                              fontSize: '0.75rem',
                              '&:hover': {
                                borderColor: '#9CA3AF',
                                backgroundColor: '#F9FAFB',
                              },
                            }}
                          >
                            Dismiss
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#10B981', 
                      fontWeight: 500,
                      mb: 1
                    }}
                  >
                    🎉 No critical posts found!
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#718096'
                    }}
                  >
                    All posts from the last 24 hours have positive sentiment
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Review Modal */}
      <ReviewModal
        open={reviewModalOpen}
        onClose={handleCloseReviewModal}
        message={selectedMessage}
      />
    </Box>
  );
};
