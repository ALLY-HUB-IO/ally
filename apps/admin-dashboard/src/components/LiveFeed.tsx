import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Message } from '../types';
import { apiService } from '../services/api';

interface LiveFeedProps {
  limit?: number;
  refreshInterval?: number;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ 
  limit = 10, 
  refreshInterval = 5000
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchLiveFeed = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
      const response = await apiService.getLiveFeed({
        limit,
        since: since.toISOString()
      });
      
      setMessages(Array.isArray(response.data) ? response.data : []);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      console.error('LiveFeed fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load live feed');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLiveFeed();
    const interval = setInterval(fetchLiveFeed, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchLiveFeed, refreshInterval]);

  const getSentimentColor = (score: number | null) => {
    if (score === null || score === undefined) return '#7B2CBF'; // Purple - Scoring
    if (score > 0.8) return '#10B981'; // Green - Very Positive
    if (score > 0.6) return '#84CC16'; // Light Green - Positive
    if (score > 0.4) return '#F59E0B'; // Yellow - Neutral
    if (score > 0.2) return '#F97316'; // Orange - Negative
    return '#EF4444'; // Red - Very Negative
  };

  const getSentimentLabel = (score: number | null) => {
    if (score === null || score === undefined) return 'Scoring...';
    if (score > 0.8) return 'Very Positive';
    if (score > 0.6) return 'Positive';
    if (score > 0.4) return 'Neutral';
    if (score > 0.2) return 'Negative';
    return 'Very Negative';
  };

  const getPlatformIcon = (platform: string | null | undefined) => {
    if (!platform) return null;
    switch (platform.toLowerCase()) {
      case 'discord': return '/images/logo-discord.svg';
      case 'telegram': return '/images/logo-telegram.svg';
      case 'twitter':
      case 'x': return '/images/logo-x.svg';
      default: return null;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const messageDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  if (loading && (!messages || messages.length === 0)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2D3748' }}>
          Live Update Feed
        </Typography>
        <Typography variant="caption" sx={{ color: '#718096' }}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto' }}>
        {!messages || messages.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#718096', textAlign: 'center', py: 2 }}>
            No recent activity
          </Typography>
        ) : (
          messages.map((message, index) => (
            <Box key={message.id} sx={{ display: 'flex', gap: 2, pb: 2, borderBottom: index < messages.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {getPlatformIcon(message.platform || 'unknown') ? (
                  <img 
                    src={getPlatformIcon(message.platform || 'unknown')!} 
                    alt={message.platform || 'unknown'}
                    style={{ width: 24, height: 24 }}
                  />
                ) : (
                  <Box sx={{ fontSize: '1.5rem' }}>
                    📱
                  </Box>
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#2D3748' }}>
                    {message.score !== null && message.score !== undefined 
                      ? `Post analyzed: ${getSentimentLabel(message.score)} sentiment`
                      : 'Post being analyzed...'
                    }
                  </Typography>
                  <Chip 
                    label={getSentimentLabel(message.score)} 
                    size="small" 
                    sx={{ 
                      backgroundColor: getSentimentColor(message.score), 
                      color: 'white', 
                      fontWeight: 500,
                      fontSize: '0.65rem',
                      height: 20,
                      '& .MuiChip-label': { px: 1 }
                    }} 
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                  {message.content && message.content.length > 100 
                    ? `${message.content.substring(0, 100)}...` 
                    : message.content || 'No content'
                  }
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#A0AEC0' }}>
                    {message.createdAt ? formatTimeAgo(message.createdAt) : 'Unknown time'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#7B2CBF', fontWeight: 600 }}>
                    {message.score !== null && message.score !== undefined 
                      ? `Score: ${message.score.toFixed(2)}`
                      : 'Analyzing...'
                    }
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
