import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  Grid,
  Card,
  CardContent,
  Link,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  TrendingDown as TrendingDownIcon,
  Psychology as PsychologyIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  message: any;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ open, onClose, message }) => {
  if (!message) return null;

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

  const getPlatformUrl = (platform: string, message: any) => {
    switch (platform.toLowerCase()) {
      case 'discord':
        // For Discord, construct link with guildId/channelId/messageId format
        if (message.discordDetails?.guildId && message.discordDetails?.channelId) {
          // Use externalId as the message ID for the Discord link
          return `https://discord.com/channels/${message.discordDetails.guildId}/${message.discordDetails.channelId}/${message.externalId}`;
        }
        // Fallback to source platformId if discordDetails not available
        return `https://discord.com/channels/${message.source?.platformId || 'unknown'}`;
      
      case 'telegram':
        // For Telegram, use the source name or platformId
        const telegramChannel = message.source?.name || message.source?.platformId || 'unknown';
        return `https://t.me/${telegramChannel}`;
      
      case 'twitter':
      case 'x':
        // For Twitter/X, use the externalId as the tweet ID
        return `https://x.com/i/web/status/${message.externalId || 'unknown'}`;
      
      default:
        return '#';
    }
  };

  const getPlatformIcon = (platform: string): string | undefined => {
    switch (platform.toLowerCase()) {
      case 'discord':
        return '/images/logo-discord.svg';
      case 'telegram':
        return '/images/logo-telegram.svg';
      case 'twitter':
      case 'x':
        return '/images/logo-x.svg';
      default:
        return undefined;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const safeFormatScore = (score: any): string => {
    if (score === null || score === undefined) return 'N/A';
    const numScore = typeof score === 'number' ? score : parseFloat(score);
    return isNaN(numScore) ? 'N/A' : numScore.toFixed(3);
  };

  const safeGetScoreColor = (score: any): string => {
    if (score === null || score === undefined) return 'error';
    const numScore = typeof score === 'number' ? score : parseFloat(score);
    if (isNaN(numScore)) return 'error';
    if (numScore >= 0.8) return 'success';
    if (numScore >= 0.6) return 'primary';
    if (numScore >= 0.4) return 'warning';
    return 'error';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1,
        borderBottom: '1px solid #E2E8F0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TrendingDownIcon sx={{ color: getSeverityColor(message.score) }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Review Critical Post
          </Typography>
          <Chip
            label={getSeverityLabel(message.score)}
            size="small"
            sx={{
              backgroundColor: getSeverityColor(message.score),
              color: 'white',
              fontWeight: 600,
            }}
          />
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Post Content */}
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: '#FEFEFE', border: '1px solid #FEE2E2' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#374151' }}>
                  Post Content
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    lineHeight: 1.6, 
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {message.content}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Post Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon />
                  Post Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      Platform
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      {getPlatformIcon(message.platform) && (
                        <img 
                          src={getPlatformIcon(message.platform)} 
                          alt={message.platform}
                          style={{ width: 20, height: 20 }}
                        />
                      )}
                      <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                        {message.platform}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      Posted At
                    </Typography>
                    <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <ScheduleIcon sx={{ fontSize: 16, color: '#718096' }} />
                      {formatDate(message.createdAt)}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      Message ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                      {message.id}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      External ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                      {message.externalId}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Author Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon />
                  Author Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      Display Name
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {message.author?.displayName || 'Unknown'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      Platform
                    </Typography>
                    <Typography variant="body1" sx={{ textTransform: 'capitalize', mt: 0.5 }}>
                      {message.author?.platform || 'Unknown'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      Trust Score
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {message.author?.user?.trust?.toFixed(3) || 'N/A'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                      Wallet Address
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5, wordBreak: 'break-all' }}>
                      {message.author?.user?.wallet || 'Not connected'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Score Analysis */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PsychologyIcon />
                  Score Analysis
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#FEF2F2', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ color: getSeverityColor(message.score), fontWeight: 700 }}>
                        {message.score.toFixed(3)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#718096', mt: 0.5 }}>
                        Overall Score
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#F9FAFB', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ color: '#374151', fontWeight: 700 }}>
                        {message.scores?.length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#718096', mt: 0.5 }}>
                        Score Components
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#F9FAFB', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ color: '#374151', fontWeight: 700 }}>
                        {message.scores?.[0]?.kind || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#718096', mt: 0.5 }}>
                        Primary Score Type
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#F9FAFB', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ color: '#374151', fontWeight: 700 }}>
                        {message.scores?.[0]?.value?.toFixed(3) || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#718096', mt: 0.5 }}>
                        Primary Score Value
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Detailed Score Breakdown */}
                {message.scores && message.scores.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Detailed Score Breakdown
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {message.scores.map((score: any, index: number) => (
                        <Box key={index} sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          p: 2,
                          backgroundColor: '#F9FAFB',
                          borderRadius: 1,
                          border: '1px solid #E5E7EB'
                        }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {score.kind}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#718096' }}>
                              {formatDate(score.createdAt)}
                            </Typography>
                          </Box>
                          <Typography variant="h6" sx={{ color: getSeverityColor(score.value) }}>
                            {score.value.toFixed(3)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Detailed Score Components */}
                {message.scores && message.scores.length > 0 && message.scores[0]?.details && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Score Components Analysis
                    </Typography>
                    <Grid container spacing={2}>
                      {(() => {
                        const details = message.scores[0].details;
                        const scoreComponents = [];
                        
                        // Extract sentiment score if available
                        if (details.sentiment) {
                          scoreComponents.push(
                            <Grid item xs={12} md={4} key="sentiment">
                              <Box sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2, backgroundColor: '#FFFFFF', height: '100%' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2D3748', mb: 1 }}>
                                  Sentiment Analysis
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="h6" sx={{ color: safeGetScoreColor(details.sentiment.score) === 'success' ? '#10B981' : 
                                    safeGetScoreColor(details.sentiment.score) === 'primary' ? '#3B82F6' : 
                                    safeGetScoreColor(details.sentiment.score) === 'warning' ? '#F59E0B' : '#EF4444' }}>
                                    {safeFormatScore(details.sentiment.score)}
                                  </Typography>
                                  <Chip
                                    label={details.sentiment.label || 'N/A'}
                                    size="small"
                                    color={safeGetScoreColor(details.sentiment.score) as any}
                                  />
                                </Box>
                                <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                  Model: {details.sentiment.model || 'N/A'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                  Weight: {details.sentiment.weight || 'N/A'} | 
                                  Weighted Score: {safeFormatScore(details.sentiment.weightedScore)}
                                </Typography>
                              </Box>
                            </Grid>
                          );
                        }
                        
                        // Extract value score if available
                        if (details.value) {
                          scoreComponents.push(
                            <Grid item xs={12} md={4} key="value">
                              <Box sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2, backgroundColor: '#FFFFFF', height: '100%' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2D3748', mb: 1 }}>
                                  Value Analysis
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="h6" sx={{ color: safeGetScoreColor(details.value.score.score) === 'success' ? '#10B981' : 
                                    safeGetScoreColor(details.value.score.score) === 'primary' ? '#3B82F6' : 
                                    safeGetScoreColor(details.value.score.score) === 'warning' ? '#F59E0B' : '#EF4444' }}>
                                    {safeFormatScore(details.value.score.score)}
                                  </Typography>
                                  <Chip
                                    label={details.value.label || 'N/A'}
                                    size="small"
                                    color={safeGetScoreColor(details.value.score.score) as any}
                                  />
                                </Box>
                                <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                  Model: {details.value.model || 'N/A'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                  Weight: {details.value.weight || 'N/A'} | 
                                  Weighted Score: {safeFormatScore(details.value.weightedScore || details.value.score.score * details.value.weight)}
                                </Typography>
                              </Box>
                            </Grid>
                          );
                        }
                        
                        // Extract uniqueness score if available
                        if (details.uniqueness) {
                          scoreComponents.push(
                            <Grid item xs={12} md={4} key="uniqueness">
                              <Box sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2, backgroundColor: '#FFFFFF', height: '100%' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2D3748', mb: 1 }}>
                                  Uniqueness Analysis
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="h6" sx={{ color: safeGetScoreColor(details.uniqueness.score) === 'success' ? '#10B981' : 
                                    safeGetScoreColor(details.uniqueness.score) === 'primary' ? '#3B82F6' : 
                                    safeGetScoreColor(details.uniqueness.score) === 'warning' ? '#F59E0B' : '#EF4444' }}>
                                    {safeFormatScore(details.uniqueness.score)}
                                  </Typography>
                                  <Chip
                                    label={details.uniqueness.label || 'N/A'}
                                    size="small"
                                    color={safeGetScoreColor(details.uniqueness.score) as any}
                                  />
                                </Box>
                                <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                  Model: {details.uniqueness.model || 'N/A'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                  Weight: {details.uniqueness.weight || 'N/A'} | 
                                  Weighted Score: {safeFormatScore(details.uniqueness.weightedScore)}
                                </Typography>
                                {details.uniqueness.breakdown?.maxCosine !== undefined && (
                                  <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                    Max Cosine: {safeFormatScore(details.uniqueness.breakdown.maxCosine)}
                                  </Typography>
                                )}
                              </Box>
                            </Grid>
                          );
                        }
                        
                        return scoreComponents;
                      })()}
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #E2E8F0' }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderColor: '#D1D5DB',
            color: '#6B7280',
            '&:hover': {
              borderColor: '#9CA3AF',
              backgroundColor: '#F9FAFB',
            },
          }}
        >
          Close
        </Button>
        <Button
          component={Link}
          href={getPlatformUrl(message.platform, message)}
          target="_blank"
          rel="noopener noreferrer"
          variant="contained"
          startIcon={<OpenInNewIcon />}
          sx={{
            backgroundColor: '#7B2CBF',
            '&:hover': {
              backgroundColor: '#5A189A',
            },
          }}
        >
          View on {message.platform}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReviewModal;
