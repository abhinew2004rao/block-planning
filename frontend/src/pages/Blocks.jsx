import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tabs,
  Tab,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import SpeedIcon from '@mui/icons-material/Speed';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ScheduleIcon from '@mui/icons-material/Schedule';

import api, { BLOCKS } from '../api/axios';
import BlockDetailsDialog from '../components/BlockDetailsDialog';

// Estimated Train Impact color coding: low=green, medium=orange, high=red
const getTrainImpactInfo = (val) => {
  if (typeof val === 'string') {
    const s = val.toLowerCase();
    if (s === 'low') {
      return { label: 'Low', color: '#4caf50', bgcolor: 'rgba(76, 175, 80, 0.16)', border: '1px solid rgba(76, 175, 80, 0.4)' };
    }
    if (s === 'medium') {
      return { label: 'Medium', color: '#ff9800', bgcolor: 'rgba(255, 152, 0, 0.16)', border: '1px solid rgba(255, 152, 0, 0.4)' };
    }
    if (s === 'high') {
      return { label: 'High', color: '#f44336', bgcolor: 'rgba(244, 67, 54, 0.16)', border: '1px solid rgba(244, 67, 54, 0.4)' };
    }
  }
  const num = Number(val) || 0;
  if (num >= 60) {
    return {
      label: `High (${num.toFixed(1)})`,
      color: '#f44336', // Red
      bgcolor: 'rgba(244, 67, 54, 0.16)',
      border: '1px solid rgba(244, 67, 54, 0.4)',
    };
  }
  if (num >= 30) {
    return {
      label: `Medium (${num.toFixed(1)})`,
      color: '#ff9800', // Orange
      bgcolor: 'rgba(255, 152, 0, 0.16)',
      border: '1px solid rgba(255, 152, 0, 0.4)',
    };
  }
  return {
    label: `Low (${num.toFixed(1)})`,
    color: '#4caf50', // Green
    bgcolor: 'rgba(76, 175, 80, 0.16)',
    border: '1px solid rgba(76, 175, 80, 0.4)',
  };
};

/**
 * Blocks Page Component for Indian Railways Block Planning Dashboard
 *
 * Requirements:
 * - Fetch blocks from GET /blocks?skip=0&limit=100
 * - Display in DataGrid
 * - Columns:
 *   * block_id
 *   * block_date
 *   * start_time
 *   * end_time
 *   * section_code
 *   * block_type
 *   * departments_involved (array, show as chips)
 *   * planned_tasks_count
 *   * estimated_train_impact (with color: low=green, medium=orange, high=red)
 *   * status (planned, approved, in_progress, completed)
 * - Add tabs:
 *   * All Blocks
 *   * Planned
 *   * Approved
 *   * This Week
 * - Add "Export CSV" button (GET /blocks/export/csv)
 * - Add "Run Optimization" button (navigates to /optimization)
 * - Click row to see block details (dialog)
 */
export default function Blocks() {
  const navigate = useNavigate();

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Tab State: 'all', 'planned', 'approved', 'this_week'
  const [activeTab, setActiveTab] = useState('all');

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Row selection for Block Details Dialog
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch blocks from API
  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${BLOCKS}?skip=0&limit=100`);
      setBlocks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch corridor blocks:', err);
      setError(err.message || 'Error fetching planned corridor blocks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  // Handle Export CSV
  const handleExportCSV = async () => {
    setExportLoading(true);
    setError(null);
    try {
      const res = await api.get(`${BLOCKS}/export/csv`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `corridor_blocks_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg('Planned corridor blocks exported successfully as CSV.');
    } catch (err) {
      console.error('CSV Export failed:', err);
      setError(err.message || 'Failed to download blocks CSV export');
    } finally {
      setExportLoading(false);
    }
  };

  // Open Block Details Dialog on Row Click
  const handleRowClick = (row) => {
    setSelectedBlock(row);
    setDialogOpen(true);
  };

  // Check if date falls in current/upcoming week
  const isThisWeek = (dateStr) => {
    if (!dateStr) return false;
    const blockDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 2);
    return blockDate >= startOfWeek && blockDate <= endOfWeek;
  };

  // Filter blocks based on Active Tab and Search
  const filteredBlocks = useMemo(() => {
    return blocks.filter((item) => {
      // Tab Filtering
      if (activeTab === 'planned' && item.status !== 'planned') {
        return false;
      }
      if (activeTab === 'approved' && item.status !== 'approved') {
        return false;
      }
      if (activeTab === 'this_week' && !isThisWeek(item.block_date)) {
        return false;
      }

      // Keyword Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          String(item.block_id).includes(q) ||
          item.section_code?.toLowerCase().includes(q) ||
          item.corridor_id?.toLowerCase().includes(q) ||
          item.block_type?.toLowerCase().includes(q) ||
          item.status?.toLowerCase().includes(q) ||
          (Array.isArray(item.departments_involved) &&
            item.departments_involved.some((dept) => dept.toLowerCase().includes(q)))
        );
      }
      return true;
    });
  }, [blocks, activeTab, searchQuery]);

  // Tab count metrics
  const totalCount = blocks.length;
  const plannedCount = blocks.filter((b) => b.status === 'planned').length;
  const approvedCount = blocks.filter((b) => b.status === 'approved').length;
  const thisWeekCount = blocks.filter((b) => isThisWeek(b.block_date)).length;
  const totalDurationHours = (
    blocks.reduce((acc, b) => acc + (b.duration_min || 0), 0) / 60
  ).toFixed(1);

  // DataGrid Column Definitions
  const columns = [
    {
      field: 'block_id',
      headerName: 'Block ID',
      width: 110,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.main' }}>
          BLK-{params.value}
        </Typography>
      ),
    },
    {
      field: 'block_date',
      headerName: 'Block Date',
      width: 130,
      valueFormatter: (value) => value || '-',
    },
    {
      field: 'start_time',
      headerName: 'Start Time',
      width: 110,
      valueFormatter: (value) => (value ? String(value).slice(0, 5) : '-'),
    },
    {
      field: 'end_time',
      headerName: 'End Time',
      width: 110,
      valueFormatter: (value) => (value ? String(value).slice(0, 5) : '-'),
    },
    {
      field: 'section_code',
      headerName: 'Section Code',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          sx={{ bgcolor: 'rgba(255, 255, 255, 0.06)', fontWeight: 600, fontSize: '0.75rem' }}
        />
      ),
    },
    {
      field: 'block_type',
      headerName: 'Block Type',
      width: 130,
      renderCell: (params) => {
        const type = (params.value || '').toLowerCase();
        const color =
          type === 'power' ? 'secondary' : type === 'caution' ? 'warning' : 'info';
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
      field: 'departments_involved',
      headerName: 'Departments Involved',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => {
        const depts = Array.isArray(params.value) ? params.value : [];
        return (
          <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', alignItems: 'center', py: 0.5 }}>
            {depts.map((dept) => {
              const color =
                dept === 'P.Way'
                  ? '#2196f3'
                  : dept === 'S&T'
                  ? '#4caf50'
                  : dept === 'TRD'
                  ? '#ff9800'
                  : '#9c27b0';
              return (
                <Chip
                  key={dept}
                  label={dept}
                  size="small"
                  sx={{
                    bgcolor: `${color}18`,
                    color,
                    border: `1px solid ${color}40`,
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    height: 22,
                  }}
                />
              );
            })}
          </Box>
        );
      },
    },
    {
      field: 'planned_tasks_count',
      headerName: 'Tasks',
      width: 100,
      type: 'number',
      renderCell: (params) => (
        <Chip
          label={`${params.value ?? 0} Tasks`}
          size="small"
          sx={{
            bgcolor: 'rgba(78, 168, 222, 0.12)',
            color: '#4ea8de',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        />
      ),
    },
    {
      field: 'estimated_train_impact',
      headerName: 'Train Impact',
      width: 150,
      renderCell: (params) => {
        const conf = getTrainImpactInfo(params.value);
        return (
          <Chip
            label={conf.label}
            size="small"
            sx={{
              color: conf.color,
              bgcolor: conf.bgcolor,
              border: conf.border,
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          />
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => {
        const status = (params.value || 'planned').toLowerCase();
        let color = 'default';
        if (status === 'planned') color = 'warning';
        else if (status === 'approved') color = 'success';
        else if (status === 'in_progress') color = 'info';
        else if (status === 'completed') color = 'default';

        return (
          <Chip
            label={status}
            size="small"
            color={color}
            variant="filled"
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'capitalize',
            }}
          />
        );
      },
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
            Corridor Block Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Consolidated multi-department corridor traffic possessions and operational impact schedules
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh Block Schedules">
            <span>
              <IconButton
                onClick={fetchBlocks}
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

          {/* Export CSV Button */}
          <Button
            variant="outlined"
            color="primary"
            startIcon={
              exportLoading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />
            }
            disabled={exportLoading}
            onClick={handleExportCSV}
            sx={{ fontWeight: 700 }}
          >
            {exportLoading ? 'Exporting...' : 'Export CSV'}
          </Button>

          {/* Run Optimization Button */}
          <Button
            variant="contained"
            color="secondary"
            startIcon={<SpeedIcon />}
            onClick={() => navigate('/optimization')}
            sx={{
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(244, 162, 97, 0.35)',
            }}
          >
            Run Optimization
          </Button>
        </Box>
      </Box>

      {/* KPI Overview Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(78, 168, 222, 0.3)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(78, 168, 222, 0.12)',
                    color: '#4ea8de',
                    display: 'flex',
                  }}
                >
                  <EventAvailableIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    TOTAL BLOCKS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {totalCount} Windows
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
                  <PendingActionsIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    PLANNED
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#ff9800">
                    {plannedCount} Pending
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
                  <CheckCircleIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    APPROVED
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#4caf50">
                    {approvedCount} Authorized
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid rgba(244, 162, 97, 0.3)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(244, 162, 97, 0.12)',
                    color: '#f4a261',
                    display: 'flex',
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    POSSESSION HOURS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {totalDurationHours} hrs
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
            <Button color="inherit" size="small" onClick={fetchBlocks}>
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

      {/* DataGrid Card with Tabs */}
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2.5,
        }}
      >
        {/* Navigation Tabs and Search */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            pb: 1.5,
          }}
        >
          {/* Tabs: All Blocks, Planned, Approved, This Week */}
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: '0.88rem',
                minWidth: 110,
                textTransform: 'none',
              },
            }}
          >
            <Tab label={`All Blocks (${totalCount})`} value="all" />
            <Tab label={`Planned (${plannedCount})`} value="planned" />
            <Tab label={`Approved (${approvedCount})`} value="approved" />
            <Tab label={`This Week (${thisWeekCount})`} value="this_week" />
          </Tabs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              💡 Tip: Click any row to view packed tasks & details
            </Typography>
            <TextField
              size="small"
              placeholder="Search section, type, dept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                width: { xs: '100%', sm: 260 },
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        {/* DataGrid Table */}
        <Box sx={{ height: 650, width: '100%' }}>
          <DataGrid
            rows={filteredBlocks}
            columns={columns}
            getRowId={(row) => row.block_id}
            loading={loading}
            onRowClick={(params) => handleRowClick(params.row)}
            checkboxSelection
            disableRowSelectionOnClick
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
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                '&:hover': {
                  backgroundColor: 'rgba(78, 168, 222, 0.06)',
                },
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                fontWeight: 700,
                fontSize: '0.85rem',
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

      {/* Modular Block Details Dialog */}
      <BlockDetailsDialog
        open={dialogOpen}
        blockId={selectedBlock?.block_id}
        initialBlock={selectedBlock}
        onClose={() => setDialogOpen(false)}
        onBlockUpdated={(blockId) => {
          setSuccessMsg(`Block #BLK-${blockId} has been successfully approved!`);
          fetchBlocks();
        }}
      />
    </Box>
  );
}
