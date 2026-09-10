import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EngineeringIcon from '@mui/icons-material/Engineering';
import TrafficIcon from '@mui/icons-material/Traffic';
import AltRouteIcon from '@mui/icons-material/AltRoute';

import AssetDialog from '../components/AssetDialog';
import api, { ASSETS } from '../api/axios';

/**
 * Assets Page Component for Indian Railways Block Planning System
 *
 * Requirements:
 * - Fetch assets from GET /assets?skip=0&limit=100
 * - Display in Material-UI DataGrid
 * - Columns:
 *   * asset_id
 *   * asset_type
 *   * sub_type
 *   * section_code
 *   * km_start
 *   * km_end
 *   * line_category
 *   * traffic_density_class
 * - Features:
 *   * Pagination (100 rows per page)
 *   * Sorting (click column headers)
 *   * Filtering (search box)
 *   * Row selection
 * - Add "Create Asset" button (opens AssetDialog)
 * - Add "Edit" and "Delete" buttons for each row
 * - Responsive design
 * - Loading state
 * - Error handling
 */
export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search filtering
  const [searchTerm, setSearchTerm] = useState('');

  // Row selection
  const [selectedRowIds, setSelectedRowIds] = useState({ type: 'include', ids: new Set() });

  // AssetDialog state (both create & edit)
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Row deletion state
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  // Fetch assets list from API
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${ASSETS}?skip=0&limit=100`);
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      setError(err.message || 'Error fetching asset inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Handle Delete Asset
  const handleDelete = async (assetId) => {
    if (!window.confirm(`Are you sure you want to delete Asset #AST-${assetId}?`)) {
      return;
    }
    setDeleteLoadingId(assetId);
    setError(null);
    try {
      await api.delete(`${ASSETS}/${assetId}`);
      setSuccessMsg(`Asset #AST-${assetId} successfully deleted.`);
      await fetchAssets();
    } catch (err) {
      setError(err.message || `Failed to delete asset #AST-${assetId}`);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  // Search filtered rows
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return assets;
    const q = searchTerm.toLowerCase();
    return assets.filter((item) => {
      return (
        String(item.asset_id).includes(q) ||
        item.asset_type?.toLowerCase().includes(q) ||
        item.sub_type?.toLowerCase().includes(q) ||
        item.section_code?.toLowerCase().includes(q) ||
        item.division_code?.toLowerCase().includes(q) ||
        item.line_category?.toLowerCase().includes(q) ||
        item.traffic_density_class?.toLowerCase().includes(q) ||
        String(item.km_start).includes(q) ||
        String(item.km_end).includes(q)
      );
    });
  }, [assets, searchTerm]);

  // KPI Counts
  const trackCount = assets.filter((a) => a.asset_type?.toLowerCase() === 'track').length;
  const signalCount = assets.filter((a) => a.asset_type?.toLowerCase() === 'signal').length;
  const trdCount = assets.filter((a) => a.asset_type?.toLowerCase() === 'traction').length;

  // DataGrid Column Definitions
  const columns = [
    {
      field: 'asset_id',
      headerName: 'Asset ID',
      width: 110,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.main' }}>
          AST-{params.value}
        </Typography>
      ),
    },
    {
      field: 'asset_type',
      headerName: 'Asset Type',
      width: 130,
      renderCell: (params) => {
        const type = (params.value || '').toLowerCase();
        const color =
          type === 'track' ? 'primary' : type === 'signal' ? 'success' : 'secondary';
        return (
          <Chip
            label={params.value}
            size="small"
            color={color}
            variant="outlined"
            sx={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.75rem' }}
          />
        );
      },
    },
    {
      field: 'sub_type',
      headerName: 'Sub Type',
      flex: 1,
      minWidth: 160,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'section_code',
      headerName: 'Section Code',
      width: 140,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          sx={{ bgcolor: 'rgba(255, 255, 255, 0.06)', fontWeight: 600, fontSize: '0.75rem' }}
        />
      ),
    },
    {
      field: 'km_start',
      headerName: 'KM Start',
      width: 110,
      type: 'number',
      valueFormatter: (value) => (value !== undefined ? Number(value).toFixed(2) : '-'),
    },
    {
      field: 'km_end',
      headerName: 'KM End',
      width: 110,
      type: 'number',
      valueFormatter: (value) => (value !== undefined ? Number(value).toFixed(2) : '-'),
    },
    {
      field: 'line_category',
      headerName: 'Line Category',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={`Cat ${params.value}`}
          size="small"
          variant="outlined"
          sx={{ borderColor: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}
        />
      ),
    },
    {
      field: 'traffic_density_class',
      headerName: 'Traffic Density',
      width: 140,
      renderCell: (params) => (
        <Chip
          label={`Class ${params.value}`}
          size="small"
          sx={{
            bgcolor:
              params.value === 'A'
                ? 'rgba(231, 111, 81, 0.18)'
                : 'rgba(78, 168, 222, 0.18)',
            color: params.value === 'A' ? '#e76f51' : '#4ea8de',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={`Edit Asset #AST-${params.row.asset_id}`}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                setSelectedAsset(params.row);
                setOpenDialog(true);
              }}
              sx={{
                bgcolor: 'rgba(78, 168, 222, 0.08)',
                '&:hover': { bgcolor: 'rgba(78, 168, 222, 0.2)' },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={`Delete Asset #AST-${params.row.asset_id}`}>
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDelete(params.row.asset_id)}
                disabled={deleteLoadingId === params.row.asset_id}
                sx={{
                  bgcolor: 'rgba(244, 67, 54, 0.08)',
                  '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.2)' },
                }}
              >
                {deleteLoadingId === params.row.asset_id ? (
                  <CircularProgress size={18} color="error" />
                ) : (
                  <DeleteIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Header Banner */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.5rem', sm: '1.9rem', md: '2.2rem' },
              color: 'text.primary',
              letterSpacing: -0.5,
            }}
          >
            Railway Infrastructure Assets
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Corridor inventory of monitored track, signaling, and traction assets
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Asset List">
            <span>
              <IconButton
                onClick={fetchAssets}
                disabled={loading}
                color="primary"
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <RefreshIcon className={loading ? 'spinning-refresh' : ''} />
              </IconButton>
            </span>
          </Tooltip>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedAsset(null);
              setOpenDialog(true);
            }}
            sx={{
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(78, 168, 222, 0.3)',
            }}
          >
            Create Asset
          </Button>
        </Box>
      </Box>

      {/* KPI Overview Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(33, 150, 243, 0.3)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(33, 150, 243, 0.12)',
                    color: '#2196f3',
                    display: 'flex',
                  }}
                >
                  <EngineeringIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    TRACK ASSETS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {trackCount} Monitored
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(76, 175, 80, 0.12)',
                    color: '#4caf50',
                    display: 'flex',
                  }}
                >
                  <TrafficIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    SIGNAL & TELECOM
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {signalCount} Monitored
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 152, 0, 0.12)',
                    color: '#ff9800',
                    display: 'flex',
                  }}
                >
                  <AltRouteIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    TRACTION & OHE
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {trdCount} Monitored
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notifications */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={fetchAssets}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Table Container Card */}
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2.5,
        }}
      >
        {/* Search & Filter Toolbar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search by asset ID, type, section, line category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              width: { xs: '100%', sm: 380 },
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.02)',
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Showing {filteredRows.length} of {assets.length} Assets
          </Typography>
        </Box>

        {/* DataGrid Component */}
        <Box sx={{ height: 650, width: '100%' }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(row) => row.asset_id}
            loading={loading}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={(newSelection) => {
              setSelectedRowIds(newSelection);
            }}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 100, page: 0 },
              },
            }}
            pageSizeOptions={[25, 50, 100]}
            sx={{
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
              bgcolor: 'background.paper',
              color: 'text.primary',
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                fontWeight: 700,
                fontSize: '0.85rem',
              },
              '& .MuiDataGrid-row': {
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                },
              },
              '& .MuiDataGrid-cell': {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
              },
              '& .MuiDataGrid-footerContainer': {
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              },
              '& .MuiCheckbox-root': {
                color: 'rgba(255, 255, 255, 0.6)',
              },
            }}
          />
        </Box>
      </Card>

      {/* AssetDialog Component for Creating and Editing Assets */}
      <AssetDialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setSelectedAsset(null);
        }}
        onSuccess={(msg) => {
          setSuccessMsg(msg);
          fetchAssets();
        }}
        asset={selectedAsset}
      />
    </Box>
  );
}
