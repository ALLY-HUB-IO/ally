import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  OutlinedInput,
  Tooltip,
  FormHelperText,
} from '@mui/material';
import { 
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Campaign, CampaignForm } from '../types';
import { apiService } from '../services/api';

// Supported chains and platforms (matching backend)
const SUPPORTED_CHAINS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'bsc', label: 'BSC' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'optimism', label: 'Optimism' },
  { value: 'base', label: 'Base' },
  { value: 'near', label: 'NEAR' },
  { value: 'theta', label: 'Theta' },
  { value: 'theta-testnet', label: 'Theta Testnet' },
];

const SUPPORTED_PLATFORMS = [
  { value: 'discord', label: 'Discord' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'reddit', label: 'Reddit' },
];

export const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<CampaignForm>({
    name: '',
    description: '',
    tokenSymbol: '',
    isNative: false,
    chainId: 'ethereum',
    tokenAddress: '',
    totalRewardPool: '',
    startDate: '',
    endDate: '',
    minScore: undefined,
    maxRewardsPerUser: '',
    timeframe: 30,
    platforms: [],
  });

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getCampaigns({
        page: page + 1,
        limit: rowsPerPage,
      });
      setCampaigns(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenDialog = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        tokenSymbol: campaign.tokenSymbol,
        isNative: campaign.isNative,
        chainId: campaign.chainId,
        tokenAddress: campaign.tokenAddress || '',
        totalRewardPool: campaign.totalRewardPool,
        startDate: campaign.startDate.split('T')[0],
        endDate: campaign.endDate.split('T')[0],
        minScore: campaign.minScore,
        maxRewardsPerUser: campaign.maxRewardsPerUser || '',
        timeframe: campaign.timeframe,
        platforms: campaign.platforms,
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        tokenSymbol: '',
        isNative: false,
        chainId: 'ethereum',
        tokenAddress: '',
        totalRewardPool: '',
        startDate: '',
        endDate: '',
        minScore: undefined,
        maxRewardsPerUser: '',
        timeframe: 30,
        platforms: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCampaign(null);
  };

  const handleFormChange = (field: keyof CampaignForm) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleCheckboxChange = (field: keyof CampaignForm) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.checked,
    }));
  };

  const handleSelectChange = (field: keyof CampaignForm) => (
    event: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleMultiSelectChange = (field: keyof CampaignForm) => (
    event: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof event.target.value === 'string' 
        ? event.target.value.split(',') 
        : event.target.value,
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editingCampaign) {
        await apiService.updateCampaign(editingCampaign.id, formData);
      } else {
        await apiService.createCampaign(formData);
      }
      handleCloseDialog();
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    if (window.confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
      try {
        await apiService.deleteCampaign(campaign.id);
        fetchCampaigns();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete campaign');
      }
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    try {
      if (campaign.isActive) {
        await apiService.deactivateCampaign(campaign.id);
      } else {
        await apiService.activateCampaign(campaign.id);
      }
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle campaign status');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatAmount = (amount: string) => {
    return parseFloat(amount).toLocaleString();
  };

  if (loading && campaigns.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Campaigns
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Campaign
        </Button>
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
              <TableCell>Name</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>Chain</TableCell>
              <TableCell>Platforms</TableCell>
              <TableCell>Reward Pool</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Payouts</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {campaign.name}
                  </Typography>
                  {campaign.description && (
                    <Typography variant="caption" color="textSecondary">
                      {campaign.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={campaign.tokenSymbol}
                      variant="outlined"
                      size="small"
                    />
                    {campaign.isNative && (
                      <Chip
                        label="Native"
                        color="primary"
                        size="small"
                        variant="filled"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={SUPPORTED_CHAINS.find(c => c.value === campaign.chainId)?.label || campaign.chainId}
                    variant="outlined"
                    size="small"
                    color="secondary"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {campaign.platforms.map((platform) => (
                      <Chip
                        key={platform}
                        label={SUPPORTED_PLATFORMS.find(p => p.value === platform)?.label || platform}
                        size="small"
                        variant="outlined"
                        color="info"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatAmount(campaign.totalRewardPool)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={campaign.isActive ? 'Active' : 'Inactive'}
                    color={campaign.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(campaign.startDate)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(campaign.endDate)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {campaign.stats.completedPayouts} / {campaign.stats.totalPayouts}
                  </Typography>
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleToggleActive(campaign)}
                    title={campaign.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {campaign.isActive ? <PauseIcon /> : <PlayIcon />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(campaign)}
                    title="Edit"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(campaign)}
                    title="Delete"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Campaign Name"
              value={formData.name}
              onChange={handleFormChange('name')}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={handleFormChange('description')}
              fullWidth
              multiline
              rows={3}
            />
            
            {/* Token Configuration */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="Token Symbol"
                value={formData.tokenSymbol}
                onChange={handleFormChange('tokenSymbol')}
                required
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Chain</InputLabel>
                <Select
                  value={formData.chainId}
                  onChange={handleSelectChange('chainId')}
                  label="Chain"
                  required
                >
                  {SUPPORTED_CHAINS.map((chain) => (
                    <MenuItem key={chain.value} value={chain.value}>
                      {chain.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Native Token Configuration */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isNative}
                    onChange={handleCheckboxChange('isNative')}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography>Native Token</Typography>
                    <Tooltip title="Check if this is a native blockchain token (e.g., ETH, MATIC). Uncheck for ERC-20 tokens.">
                      <InfoIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Box>
                }
              />
            </Box>

            {/* Token Address - Conditional */}
            {!formData.isNative && (
              <TextField
                label="Token Address"
                value={formData.tokenAddress}
                onChange={handleFormChange('tokenAddress')}
                fullWidth
                required
                helperText="Contract address of the ERC-20 token"
              />
            )}

            {/* Platforms Selection */}
            <FormControl fullWidth required>
              <InputLabel>Platforms</InputLabel>
              <Select
                multiple
                value={formData.platforms}
                onChange={handleMultiSelectChange('platforms')}
                input={<OutlinedInput label="Platforms" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={SUPPORTED_PLATFORMS.find(p => p.value === value)?.label || value}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {SUPPORTED_PLATFORMS.map((platform) => (
                  <MenuItem key={platform.value} value={platform.value}>
                    {platform.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Select all platforms where this campaign will be active</FormHelperText>
            </FormControl>

            {/* Reward Configuration */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Total Reward Pool"
                value={formData.totalRewardPool}
                onChange={handleFormChange('totalRewardPool')}
                type="number"
                required
                fullWidth
                helperText="Total amount of tokens to distribute"
              />
              <TextField
                label="Max Reward Per User (Optional)"
                value={formData.maxRewardsPerUser}
                onChange={handleFormChange('maxRewardsPerUser')}
                type="number"
                fullWidth
                helperText="Maximum reward per user (leave empty for no limit)"
              />
            </Box>

            {/* Timeframe */}
            <TextField
              label="Timeframe (days)"
              value={formData.timeframe}
              onChange={handleFormChange('timeframe')}
              type="number"
              required
              inputProps={{ min: 1 }}
              helperText="Campaign duration in days"
            />

            {/* Date Range */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={handleFormChange('startDate')}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
              <TextField
                label="End Date"
                type="date"
                value={formData.endDate}
                onChange={handleFormChange('endDate')}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
            </Box>

            {/* Minimum Score */}
            <TextField
              label="Minimum Score (Optional)"
              value={formData.minScore || ''}
              onChange={handleFormChange('minScore')}
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.1 }}
              helperText="Minimum user score required to participate (0.0 - 1.0)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCampaign ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
