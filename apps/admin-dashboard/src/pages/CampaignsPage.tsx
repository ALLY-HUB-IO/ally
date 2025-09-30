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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccountBalance as FundIcon,
  Settings as StatusIcon,
} from '@mui/icons-material';
import { Campaign, CampaignForm, CampaignFundingForm, CampaignStatusForm, CampaignEpoch } from '../types';
import { apiService } from '../services/api';

// Supported chains and platforms will be loaded from the backend
let SUPPORTED_CHAINS: Array<{ value: string; label: string }> = [];
let SUPPORTED_PLATFORMS: Array<{ value: string; label: string }> = [];

export const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [fundingDialogOpen, setFundingDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
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
    maxRewardsPerUser: '',
    payoutIntervalSeconds: 604800, // 1 week in seconds
    epochRewardCap: '',
    claimWindowSeconds: 604800, // 7 days in seconds
    recycleUnclaimed: true,
    platforms: [],
  });
  const [fundingData, setFundingData] = useState<CampaignFundingForm>({
    vaultAddress: '',
    fundingTxHash: '',
    startDate: '',
  });
  const [statusData, setStatusData] = useState<CampaignStatusForm>({
    status: 'DRAFT',
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

  // Load supported configuration on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await apiService.getSupportedConfig();
        SUPPORTED_CHAINS = config.blockchains;
        SUPPORTED_PLATFORMS = config.platforms;
        setConfigLoaded(true);
      } catch (error) {
        console.error('Failed to load supported configuration:', error);
        setError('Failed to load configuration. Please refresh the page.');
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (configLoaded) {
      fetchCampaigns();
    }
  }, [fetchCampaigns, configLoaded]);

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
        startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
        endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
        maxRewardsPerUser: campaign.maxRewardsPerUser || '',
        payoutIntervalSeconds: campaign.payoutIntervalSeconds,
        epochRewardCap: campaign.epochRewardCap,
        claimWindowSeconds: campaign.claimWindowSeconds,
        recycleUnclaimed: campaign.recycleUnclaimed,
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
        maxRewardsPerUser: '',
        payoutIntervalSeconds: 604800, // 1 week in seconds
        epochRewardCap: '',
        claimWindowSeconds: 604800, // 7 days in seconds
        recycleUnclaimed: true,
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

  const handleToggleExpanded = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  const handleOpenFundingDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFundingData({
      vaultAddress: '',
      fundingTxHash: '',
      startDate: '',
    });
    setFundingDialogOpen(true);
  };

  const handleCloseFundingDialog = () => {
    setFundingDialogOpen(false);
    setSelectedCampaign(null);
  };

  const handleOpenStatusDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setStatusData({ status: campaign.status });
    setStatusDialogOpen(true);
  };

  const handleCloseStatusDialog = () => {
    setStatusDialogOpen(false);
    setSelectedCampaign(null);
  };

  const handleFundCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      await apiService.fundCampaign(selectedCampaign.id, fundingData);
      handleCloseFundingDialog();
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fund campaign');
    }
  };

  const handleUpdateCampaignStatus = async () => {
    if (!selectedCampaign) return;
    try {
      await apiService.updateCampaignStatus(selectedCampaign.id, statusData);
      handleCloseStatusDialog();
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign status');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatAmount = (amount: string) => {
    return parseFloat(amount).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'default';
      case 'ACTIVE': return 'success';
      case 'PAUSED': return 'warning';
      case 'COMPLETED': return 'info';
      case 'CANCELED': return 'error';
      default: return 'default';
    }
  };

  const getEpochStateColor = (state: string) => {
    switch (state) {
      case 'OPEN': return 'success';
      case 'CLAIMING': return 'warning';
      case 'RECYCLED': return 'info';
      case 'EXPIRED': return 'error';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  };

  const formatDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  };

  if ((loading && campaigns.length === 0) || !configLoaded) {
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
              <TableCell>Funding</TableCell>
              <TableCell>Epochs</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Payouts</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((campaign) => (
              <React.Fragment key={campaign.id}>
                <TableRow hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleExpanded(campaign.id)}
                      >
                        {expandedCampaigns.has(campaign.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {campaign.name}
                        </Typography>
                        {campaign.description && (
                          <Typography variant="caption" color="textSecondary">
                            {campaign.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
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
                    label={campaign.status}
                    color={getStatusColor(campaign.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={campaign.isFunded ? 'Funded' : 'Unfunded'}
                    color={campaign.isFunded ? 'success' : 'warning'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {campaign.epochs?.length || 0} epochs
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {campaign.startDate ? formatDate(campaign.startDate) : 'Not set'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {campaign.endDate ? formatDate(campaign.endDate) : 'Not set'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {campaign.stats.completedPayouts} / {campaign.stats.totalPayouts}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {!campaign.isFunded && (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenFundingDialog(campaign)}
                        title="Fund Campaign"
                        color="primary"
                      >
                        <FundIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleOpenStatusDialog(campaign)}
                      title="Update Status"
                    >
                      <StatusIcon />
                    </IconButton>
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
                  </Box>
                </TableCell>
              </TableRow>
              {expandedCampaigns.has(campaign.id) && campaign.epochs && (
                <TableRow>
                  <TableCell colSpan={12} sx={{ py: 2, backgroundColor: 'grey.50' }}>
                    <Box sx={{ ml: 4 }}>
                      <Typography variant="h6" gutterBottom>
                        Campaign Epochs
                      </Typography>
                      {campaign.epochs.length > 0 ? (
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Epoch #</TableCell>
                              <TableCell>State</TableCell>
                              <TableCell>Start Date</TableCell>
                              <TableCell>End Date</TableCell>
                              <TableCell>Claim Window</TableCell>
                              <TableCell>Allocated</TableCell>
                              <TableCell>Claimed</TableCell>
                              <TableCell>Remaining</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {campaign.epochs.map((epoch) => (
                              <TableRow key={epoch.id}>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="bold">
                                    #{epoch.epochNumber}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={epoch.state}
                                    color={getEpochStateColor(epoch.state)}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatDate(epoch.epochStart)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatDate(epoch.epochEnd)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatDate(epoch.claimWindowEnds)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatAmount(epoch.allocated)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatAmount(epoch.claimed)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatAmount((parseFloat(epoch.allocated) - parseFloat(epoch.claimed)).toString())}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          No epochs created yet. Epochs will be automatically created when the campaign is funded and active.
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )}
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

            {/* Epoch Configuration */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Payout Interval (seconds)"
                value={formData.payoutIntervalSeconds}
                onChange={handleFormChange('payoutIntervalSeconds')}
                type="number"
                required
                inputProps={{ min: 1 }}
                helperText={`${formatDuration(formData.payoutIntervalSeconds)} between epochs`}
                fullWidth
              />
              <TextField
                label="Claim Window (seconds)"
                value={formData.claimWindowSeconds}
                onChange={handleFormChange('claimWindowSeconds')}
                type="number"
                required
                inputProps={{ min: 1 }}
                helperText={`${formatDuration(formData.claimWindowSeconds)} to claim rewards`}
                fullWidth
              />
            </Box>

            <TextField
              label="Epoch Reward Cap"
              value={formData.epochRewardCap}
              onChange={handleFormChange('epochRewardCap')}
              type="number"
              required
              fullWidth
              helperText="Maximum rewards distributed per epoch"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.recycleUnclaimed}
                  onChange={handleCheckboxChange('recycleUnclaimed')}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>Recycle Unclaimed Rewards</Typography>
                  <Tooltip title="Automatically move unclaimed rewards back to the campaign pool">
                    <InfoIcon fontSize="small" color="action" />
                  </Tooltip>
                </Box>
              }
            />

            {/* Date Range - Optional */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Date (Optional)"
                type="date"
                value={formData.startDate}
                onChange={handleFormChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                helperText="Leave empty to set after funding"
              />
              <TextField
                label="End Date (Optional)"
                type="date"
                value={formData.endDate}
                onChange={handleFormChange('endDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
                helperText="Leave empty to set after funding"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCampaign ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Funding Dialog */}
      <Dialog open={fundingDialogOpen} onClose={handleCloseFundingDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Fund Campaign</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Vault Address"
              value={fundingData.vaultAddress}
              onChange={(e) => setFundingData(prev => ({ ...prev, vaultAddress: e.target.value }))}
              fullWidth
              required
              helperText="Address of the vault holding campaign funds"
            />
            <TextField
              label="Funding Transaction Hash"
              value={fundingData.fundingTxHash}
              onChange={(e) => setFundingData(prev => ({ ...prev, fundingTxHash: e.target.value }))}
              fullWidth
              required
              helperText="Transaction hash of the funding transaction"
            />
            <TextField
              label="Start Date (Optional)"
              type="date"
              value={fundingData.startDate}
              onChange={(e) => setFundingData(prev => ({ ...prev, startDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              helperText="Leave empty to start immediately"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFundingDialog}>Cancel</Button>
          <Button onClick={handleFundCampaign} variant="contained">
            Fund Campaign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onClose={handleCloseStatusDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Update Campaign Status</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusData.status}
                onChange={(e) => setStatusData(prev => ({ ...prev, status: e.target.value as any }))}
                label="Status"
              >
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="PAUSED">Paused</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELED">Canceled</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStatusDialog}>Cancel</Button>
          <Button onClick={handleUpdateCampaignStatus} variant="contained">
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
