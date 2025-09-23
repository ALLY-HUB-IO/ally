import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
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
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { 
  PlayArrow as ProcessIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { Payout, PayoutStatus } from '../types';
import { apiService } from '../services/api';

export const PayoutsPage: React.FC = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(new Set());
  const [processDialogOpen, setProcessDialogOpen] = useState(false);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPayouts({
        page: page + 1,
        limit: rowsPerPage,
        status: statusFilter || undefined,
      });
      setPayouts(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [page, rowsPerPage, statusFilter]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleStatusFilterChange = (event: any) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleSelectPayout = (payoutId: string) => {
    const newSelected = new Set(selectedPayouts);
    if (newSelected.has(payoutId)) {
      newSelected.delete(payoutId);
    } else {
      newSelected.add(payoutId);
    }
    setSelectedPayouts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPayouts.size === payouts.length) {
      setSelectedPayouts(new Set());
    } else {
      setSelectedPayouts(new Set(payouts.map(p => p.id)));
    }
  };

  const handleProcessSelected = async () => {
    if (selectedPayouts.size === 0) return;
    
    try {
      await apiService.processPayouts(Array.from(selectedPayouts));
      setSelectedPayouts(new Set());
      setProcessDialogOpen(false);
      fetchPayouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payouts');
    }
  };

  const handleCancelPayout = async (payout: Payout) => {
    if (window.confirm(`Are you sure you want to cancel this payout?`)) {
      try {
        await apiService.cancelPayout(payout.id);
        fetchPayouts();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel payout');
      }
    }
  };

  const getStatusColor = (status: PayoutStatus) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'PROCESSING': return 'info';
      case 'COMPLETED': return 'success';
      case 'FAILED': return 'error';
      case 'CANCELLED': return 'default';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: string) => {
    return parseFloat(amount).toLocaleString();
  };

  const canProcessPayouts = selectedPayouts.size > 0 && 
    payouts.filter(p => selectedPayouts.has(p.id) && p.status === 'PENDING').length > 0;

  if (loading && payouts.length === 0) {
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
          Payouts
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="PROCESSING">Processing</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="FAILED">Failed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<ProcessIcon />}
            onClick={() => setProcessDialogOpen(true)}
            disabled={!canProcessPayouts}
          >
            Process Selected ({selectedPayouts.size})
          </Button>
        </Box>
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
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedPayouts.size > 0 && selectedPayouts.size < payouts.length}
                  checked={payouts.length > 0 && selectedPayouts.size === payouts.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>User ID</TableCell>
              <TableCell>Campaign</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Transaction Hash</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedPayouts.has(payout.id)}
                    onChange={() => handleSelectPayout(payout.id)}
                    disabled={payout.status !== 'PENDING'}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {payout.userId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">
                    {payout.campaign.name}
                  </Typography>
                  <Chip
                    label={payout.campaign.tokenSymbol}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatAmount(payout.amount)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={payout.status}
                    color={getStatusColor(payout.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {payout.txHash ? (
                    <Typography variant="body2" fontFamily="monospace">
                      {payout.txHash.substring(0, 20)}...
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      N/A
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(payout.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {payout.status === 'PENDING' && (
                    <Button
                      size="small"
                      startIcon={<CancelIcon />}
                      onClick={() => handleCancelPayout(payout)}
                      color="error"
                    >
                      Cancel
                    </Button>
                  )}
                  {payout.errorMessage && (
                    <Typography variant="caption" color="error">
                      {payout.errorMessage}
                    </Typography>
                  )}
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

      <Dialog open={processDialogOpen} onClose={() => setProcessDialogOpen(false)}>
        <DialogTitle>Process Payouts</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to process {selectedPayouts.size} selected payouts?
            This will initiate blockchain transactions.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcessDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleProcessSelected} variant="contained" color="primary">
            Process Payouts
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
