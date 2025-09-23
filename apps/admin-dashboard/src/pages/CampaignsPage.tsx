import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { 
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import { Campaign, CampaignForm } from '../types';
import { apiService } from '../services/api';

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
    tokenAddress: '',
    totalRewardPool: '',
    startDate: '',
    endDate: '',
    minScore: undefined,
    maxRewardPerUser: '',
  });

  const fetchCampaigns = async () => {
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
  };

  useEffect(() => {
    fetchCampaigns();
  }, [page, rowsPerPage]);

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
        tokenAddress: campaign.tokenAddress || '',
        totalRewardPool: campaign.totalRewardPool,
        startDate: campaign.startDate.split('T')[0],
        endDate: campaign.endDate.split('T')[0],
        minScore: campaign.minScore,
        maxRewardPerUser: campaign.maxRewardPerUser || '',
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        tokenSymbol: '',
        tokenAddress: '',
        totalRewardPool: '',
        startDate: '',
        endDate: '',
        minScore: undefined,
        maxRewardPerUser: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCampaign(null);
  };

  const handleFormChange = (field: keyof CampaignForm) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
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
                  <Chip
                    label={campaign.tokenSymbol}
                    variant="outlined"
                    size="small"
                  />
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Token Symbol"
                value={formData.tokenSymbol}
                onChange={handleFormChange('tokenSymbol')}
                required
              />
              <TextField
                label="Token Address (Optional)"
                value={formData.tokenAddress}
                onChange={handleFormChange('tokenAddress')}
                fullWidth
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Total Reward Pool"
                value={formData.totalRewardPool}
                onChange={handleFormChange('totalRewardPool')}
                type="number"
                required
              />
              <TextField
                label="Max Reward Per User (Optional)"
                value={formData.maxRewardPerUser}
                onChange={handleFormChange('maxRewardPerUser')}
                type="number"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Date"
                type="date"
                value={formData.startDate}
                onChange={handleFormChange('startDate')}
                InputLabelProps={{ shrink: true }}
                required
              />
              <TextField
                label="End Date"
                type="date"
                value={formData.endDate}
                onChange={handleFormChange('endDate')}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Box>
            <TextField
              label="Minimum Score (Optional)"
              value={formData.minScore || ''}
              onChange={handleFormChange('minScore')}
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.1 }}
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
