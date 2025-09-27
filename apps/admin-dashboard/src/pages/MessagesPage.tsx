import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { Message } from '../types';
import { apiService } from '../services/api';

export const MessagesPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getMessages({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setMessages(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const clearSearch = () => {
    setSearch('');
    setPage(0);
  };

  const toggleRowExpansion = (messageId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedRows(newExpanded);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'primary';
    if (score >= 0.4) return 'warning';
    return 'error';
  };

  const safeFormatScore = (score: any): string => {
    if (score === null || score === undefined) return 'N/A';
    const numScore = typeof score === 'number' ? score : parseFloat(score);
    if (isNaN(numScore)) return 'N/A';
    return numScore.toFixed(3);
  };

  const safeGetScoreColor = (score: any): string => {
    if (score === null || score === undefined) return 'error';
    const numScore = typeof score === 'number' ? score : parseFloat(score);
    if (isNaN(numScore)) return 'error';
    return getScoreColor(numScore);
  };

  const getPlatformLogo = (platform: string | null | undefined) => {
    if (!platform) return null;
    const platformLower = platform.toLowerCase();
    switch (platformLower) {
      case 'discord':
        return '/images/logo-discord.svg';
      case 'telegram':
        return '/images/logo-telegram.svg';
      case 'twitter':
      case 'x':
        return '/images/logo-x.svg';
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading && messages.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Scored Messages
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          placeholder="Search messages..."
          value={search}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton onClick={clearSearch} edge="end">
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Expand</TableCell>
              <TableCell>Content</TableCell>
              <TableCell>Author</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>Platform</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {messages.map((message) => (
              <React.Fragment key={message.id}>
                <TableRow hover>
                  <TableCell>
                    <IconButton
                      onClick={() => toggleRowExpansion(message.id)}
                      size="small"
                    >
                      {expandedRows.has(message.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {truncateText(message.content)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {message.author?.displayName || message.author?.user?.wallet || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={message.score.toFixed(3)}
                      color={getScoreColor(message.score) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getPlatformLogo(message.platform) ? (
                        <img 
                          src={getPlatformLogo(message.platform)!} 
                          alt={message.platform || 'Unknown platform'}
                          style={{ width: 20, height: 20 }}
                        />
                      ) : (
                        <Box sx={{ fontSize: '1.2rem' }}>
                          📱
                        </Box>
                      )}
                      <Chip
                        label={message.platform || 'Unknown'}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(message.createdAt)}
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={expandedRows.has(message.id)} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 1 }}>
                        <Card>
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              Message Details
                            </Typography>
                            
                            {/* Message Metadata */}
                            <Box sx={{ mb: 3, p: 2, backgroundColor: '#F8F9FA', borderRadius: 2 }}>
                              <Typography variant="h6" sx={{ mb: 2, color: '#2D3748' }}>
                                Message Information
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Message ID
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#2D3748', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    {message.id}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Created At
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                    {new Date(message.createdAt).toLocaleString()}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Platform
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {getPlatformLogo(message.platform) ? (
                                      <img 
                                        src={getPlatformLogo(message.platform)!} 
                                        alt={message.platform || 'Unknown platform'}
                                        style={{ width: 16, height: 16 }}
                                      />
                                    ) : (
                                      <Box sx={{ fontSize: '1rem' }}>
                                        📱
                                      </Box>
                                    )}
                                    <Typography variant="body2" sx={{ color: '#2D3748', fontWeight: 500 }}>
                                      {message.platform || 'Unknown'}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Author
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                    {message.author?.displayName || message.author?.user?.wallet || 'Unknown'}
                                  </Typography>
                                  {message.author?.user?.trust !== undefined && (
                                    <Typography variant="caption" sx={{ color: '#718096' }}>
                                      Trust Score: {message.author.user.trust.toFixed(3)}
                                    </Typography>
                                  )}
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Project ID
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#2D3748', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    {message.projectId}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Source Channel
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                    {message.source?.name || 'Unknown Channel'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>

                            <Typography variant="body2" sx={{ mb: 2 }}>
                              <strong>Full Content:</strong> {message.content}
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                              <strong>Rationale:</strong> {message.rationale}
                            </Typography>
                            
                            {/* Score Overview */}
                            <Box sx={{ mb: 3, p: 2, backgroundColor: '#F8F9FA', borderRadius: 2 }}>
                              <Typography variant="h6" sx={{ mb: 2, color: '#2D3748' }}>
                                Score Analysis
                              </Typography>
                              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Overall Score
                                  </Typography>
                                  <Typography variant="h4" sx={{ color: getScoreColor(message.score) === 'success' ? '#10B981' : 
                                    getScoreColor(message.score) === 'primary' ? '#3B82F6' : 
                                    getScoreColor(message.score) === 'warning' ? '#F59E0B' : '#EF4444' }}>
                                    {message.score.toFixed(3)}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Score Components
                                  </Typography>
                                  <Typography variant="h6" sx={{ color: '#2D3748' }}>
                                    {message.scores?.length || 0}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" sx={{ color: '#718096', mb: 0.5 }}>
                                    Analysis Date
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                    {message.scores && message.scores.length > 0 
                                      ? new Date(message.scores[0].createdAt).toLocaleString()
                                      : 'N/A'
                                    }
                                  </Typography>
                                </Box>
                              </Box>
                              
                              {/* Detailed Score Breakdown from Details */}
                              {message.scores && message.scores.length > 0 && message.scores[0].details && (
                                <Box sx={{ mt: 3 }}>
                                  <Typography variant="h6" sx={{ mb: 2, color: '#2D3748' }}>
                                    Detailed Score Breakdown
                                  </Typography>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                                    {(() => {
                                      const details = message.scores[0].details;
                                      const scoreComponents = [];
                                      
                                      // Extract sentiment score if available
                                      if (details.sentiment) {
                                        scoreComponents.push(
                                          <Box key="sentiment" sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2, backgroundColor: '#FFFFFF' }}>
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
                                        );
                                      }
                                      
                                      // Extract value score if available
                                      if (details.value) {
                                        scoreComponents.push(
                                          <Box key="value" sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2, backgroundColor: '#FFFFFF' }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2D3748', mb: 1 }}>
                                              Value Analysis
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                              <Typography variant="h6" sx={{ color: safeGetScoreColor(details.value.score) === 'success' ? '#10B981' : 
                                                safeGetScoreColor(details.value.score) === 'primary' ? '#3B82F6' : 
                                                safeGetScoreColor(details.value.score) === 'warning' ? '#F59E0B' : '#EF4444' }}>
                                                {safeFormatScore(details.value.score)}
                                              </Typography>
                                              <Chip
                                                label={details.value.label || 'N/A'}
                                                size="small"
                                                color={safeGetScoreColor(details.value.score) as any}
                                              />
                                            </Box>
                                            <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                              Model: {details.value.model || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#2D3748', mb: 0.5 }}>
                                              Weight: {details.value.weight || 'N/A'} | 
                                              Weighted Score: {safeFormatScore(details.value.weightedScore)}
                                            </Typography>
                                          </Box>
                                        );
                                      }

                                      // Extract uniqueness score if available
                                      if (details.uniqueness) {
                                        scoreComponents.push(
                                          <Box key="uniqueness" sx={{ p: 2, border: '1px solid #E2E8F0', borderRadius: 2, backgroundColor: '#FFFFFF' }}>
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
                                        );
                                      }
                                      
                                      return scoreComponents;
                                    })()}
                                  </Box>
                                </Box>
                              )}
                            </Box>

                            {/* Detailed Score Breakdown */}
                            {message.scores && message.scores.length > 0 && (
                              <Box sx={{ mb: 3 }}>
                                <Typography variant="h6" sx={{ mb: 2, color: '#2D3748' }}>
                                  Detailed Score Breakdown
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {message.scores.map((score, index) => (
                                    <Box key={score.id} sx={{ 
                                      p: 2, 
                                      border: '1px solid #E2E8F0', 
                                      borderRadius: 2,
                                      backgroundColor: '#FFFFFF'
                                    }}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2D3748' }}>
                                          {score.kind}
                                        </Typography>
                                        <Chip
                                          label={score.value.toFixed(3)}
                                          size="small"
                                          sx={{ 
                                            backgroundColor: getScoreColor(score.value) === 'success' ? '#10B981' : 
                                              getScoreColor(score.value) === 'primary' ? '#3B82F6' : 
                                              getScoreColor(score.value) === 'warning' ? '#F59E0B' : '#EF4444',
                                            color: 'white',
                                            fontWeight: 600
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1 }}>
                                        <Box>
                                          <Typography variant="caption" sx={{ color: '#718096' }}>
                                            Source
                                          </Typography>
                                          <Typography variant="body2" sx={{ color: '#2D3748', fontWeight: 500 }}>
                                            {message.source?.platform}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant="caption" sx={{ color: '#718096' }}>
                                            Analysis Time
                                          </Typography>
                                          <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                            {new Date(score.createdAt).toLocaleString()}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant="caption" sx={{ color: '#718096' }}>
                                            Last Updated
                                          </Typography>
                                          <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                            {new Date(score.updatedAt).toLocaleString()}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant="caption" sx={{ color: '#718096' }}>
                                            Posted By
                                          </Typography>
                                          <Typography variant="body2" sx={{ color: '#2D3748' }}>
                                            {score.platformUser?.displayName || score.platformUser?.user?.wallet || 'System'}
                                          </Typography>
                                        </Box>
                                        <Box>
                                          <Typography variant="caption" sx={{ color: '#718096' }}>
                                            Score ID
                                          </Typography>
                                          <Typography variant="body2" sx={{ color: '#2D3748', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                            {score.id.substring(0, 8)}...
                                          </Typography>
                                        </Box>
                                      </Box>
                                      
                                      {/* Score Details */}
                                      {score.details && (
                                        <Box sx={{ mt: 2, p: 2, backgroundColor: '#F8F9FA', borderRadius: 1, border: '1px solid #E2E8F0' }}>
                                          <Typography variant="caption" sx={{ color: '#718096', fontWeight: 600 }}>
                                            Calculation Details
                                          </Typography>
                                          <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2" sx={{ color: '#2D3748', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                              {typeof score.details === 'string' 
                                                ? score.details 
                                                : JSON.stringify(score.details, null, 2)
                                              }
                                            </Typography>
                                          </Box>
                                        </Box>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            )}

                            {/* Score Calculation Summary */}
                            {message.scores && message.scores.length > 0 && (
                              <Box sx={{ mb: 3, p: 2, backgroundColor: '#F0F9FF', borderRadius: 2, border: '1px solid #BAE6FD' }}>
                                <Typography variant="h6" sx={{ mb: 2, color: '#0369A1' }}>
                                  Calculation Summary
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                  <Box>
                                    <Typography variant="body2" sx={{ color: '#0369A1', mb: 1 }}>
                                      <strong>Method:</strong> Simple Average
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#0369A1', mb: 1 }}>
                                      <strong>Formula:</strong> Σ(score_value * weight) / Σ(weight)
                                    </Typography>
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" sx={{ color: '#0369A1', mb: 1 }}>
                                      <strong>Score Types:</strong>
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                      {Array.from(new Set(message.scores.map(score => score.kind))).map((kind, index) => (
                                        <Chip
                                          key={`score-type-${kind}-${index}`}
                                          label={kind}
                                          size="small"
                                          variant="outlined"
                                          sx={{ 
                                            color: '#0369A1', 
                                            borderColor: '#0369A1',
                                            fontSize: '0.7rem'
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                            )}
                            {message.reactions && message.reactions.length > 0 && (
                              <Box>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Reactions:</strong>
                                </Typography>
                                {message.reactions.map((reaction) => (
                                  <Chip
                                    key={reaction.id}
                                    label={`${reaction.kind} (${reaction.platformUser.displayName || reaction.platformUser.platform})`}
                                    size="small"
                                    sx={{ mr: 1, mb: 1 }}
                                  />
                                ))}
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 20, 50, 100]}
        component="div"
        count={total}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Box>
  );
};
