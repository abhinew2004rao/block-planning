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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Grid,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BugReportIcon from '@mui/icons-material/BugReport';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

import api, { DEFECTS } from '../api/axios';

const DEPARTMENTS = ['P.Way', 'S&T', 'TRD', 'Works', 'Bridge'];
const SEVERITIES = ['critical', 'major', 'minor', 'observational'];
const STATUSES = ['open', 'in_progress', 'closed'];

// Color mapping for severity badges as requested
const SEVERITY_COLOR_MAP = {
  critical: {
    label: 'Critical',
    color: '#f44336', // Red
    bgcolor: 'rgba(244, 67, 54, 0.16)',
    border: '1px solid rgba(244, 67, 54, 0.4)',
  },
  major: {
    label: 'Major',
    color: '#ff9800', // Orange
    bgcolor: 'rgba(255, 152, 0, 0.16)',
    border: '1px solid rgba(255, 152, 0, 0.4)',
  },
  minor: {
    label: 'Minor',
    color: '#fbc02d', // Yellow / Amber
    bgcolor: 'rgba(251, 192, 45, 0.16)',
    border: '1px solid rgba(251, 192, 45, 0.4)',
  },
  observational: {
    label: 'Observational',
    color: '#4caf50', // Green
    bgcolor: 'rgba(76, 175, 80, 0.16)',
    border: '1px solid rgba(76, 175, 80, 0.4)',
  },
};

const getInitialDefectForm = () => ({
  asset_id: 1,
  department: 'P.Way',
  defect_type: 'Rail Surface Flaw / Micro-crack',
  defect_severity: 'critical',
  detected_date: new Date().toISOString().split('T')[0],
  detected_by: 'SSE / Track Patrol',
  status: 'open',
  recommended_action: 'Perform ultrasonic weld inspection and emergency rail replacement',
  estimated_work_duration_min: 90,
  max_allowed_delay_days: 2,
  source_system: 'TMS',
  source_defect_id: `DEF-TMS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
});

/**
 * Defects Page Component for Indian Railways Block Planning System
 *
 * Requirements:
 * - Fetch defects from GET /defects?skip=0&limit=1000&order=desc
 * - Display in DataGrid
 * - Columns:
 *   * defect_id
 *   * asset_id
 *   * department
 *   * defect_type
 *   * defect_severity (color coding: critical=red, major=orange, minor=yellow, observational=green)
 *   * status (chip: open, in_progress, closed)
 *   * detected_date
 *   * recommended_action
 * - Add filters:
 *   * Department (dropdown)
 *   * Severity (dropdown)
 *   * Status (dropdown)
 * - Add "Create Defect" button
 * - Color-code severity badges
 * - Responsive
 */
export default function Defects() {
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filter States
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Defect Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState(getInitialDefectForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  // Fetch defects list
  const fetchDefects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${DEFECTS}?skip=0&limit=1000&order=desc`);
      setDefects(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch defects:', err);
      setError(err.message || 'Error fetching defect registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDefects();
  }, [fetchDefects]);

  // Handle Create Defect Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setDialogError(null);

    if (!formData.defect_type.trim()) {
      setDialogError('Defect Type is required.');
      return;
    }
    if (!formData.recommended_action.trim()) {
      setDialogError('Recommended Action is required.');
      return;
    }
    if (Number(formData.asset_id) <= 0) {
      setDialogError('A valid positive Asset ID is required.');
      return;
    }
    if (Number(formData.estimated_work_duration_min) <= 0) {
      setDialogError('Estimated duration must be greater than 0 minutes.');
      return;
    }
    if (Number(formData.max_allowed_delay_days) < 0) {
      setDialogError('Max allowed delay cannot be negative.');
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        ...formData,
        asset_id: Number(formData.asset_id),
        estimated_work_duration_min: Number(formData.estimated_work_duration_min),
        max_allowed_delay_days: Number(formData.max_allowed_delay_days),
      };
      const res = await api.post(DEFECTS, payload);
      const newDefect = res.data;
      const newId = newDefect?.defect_id ? `#DEF-${newDefect.defect_id}` : '';

      // Immediately prepend newly created defect to state so it appears in table & counts
      if (newDefect && newDefect.defect_id) {
        setDefects((prev) => {
          if (prev.some((d) => d.defect_id === newDefect.defect_id)) return prev;
          return [newDefect, ...prev];
        });
      }

      setSuccessMsg(`Defect ${newId} logged successfully and queued for block planning.`);
      setOpenDialog(false);
      setFormData(getInitialDefectForm());
      await fetchDefects();
    } catch (err) {
      console.error('Create defect failed:', err);
      setDialogError(err.message || 'Failed to create defect record. Please verify fields.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Filter defects list based on dropdowns and search input
  const filteredDefects = useMemo(() => {
    return defects.filter((item) => {
      // 1. Department filter
      if (departmentFilter !== 'all' && item.department !== departmentFilter) {
        return false;
      }
      // 2. Severity filter
      if (
        severityFilter !== 'all' &&
        item.defect_severity?.toLowerCase() !== severityFilter.toLowerCase()
      ) {
        return false;
      }
      // 3. Status filter
      if (statusFilter !== 'all') {
        const s = (item.status || '').toLowerCase();
        if (statusFilter === 'open' && s !== 'open' && s !== 'acknowledged') {
          return false;
        }
        if (statusFilter === 'in_progress' && s !== 'in_progress') {
          return false;
        }
        if (statusFilter === 'closed' && s !== 'closed') {
          return false;
        }
      }
      // 4. Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          String(item.defect_id).includes(q) ||
          String(item.asset_id).includes(q) ||
          item.defect_type?.toLowerCase().includes(q) ||
          item.department?.toLowerCase().includes(q) ||
          item.recommended_action?.toLowerCase().includes(q) ||
          item.detected_by?.toLowerCase().includes(q) ||
          item.source_defect_id?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [defects, departmentFilter, severityFilter, statusFilter, searchQuery]);

  const resetFilters = () => {
    setDepartmentFilter('all');
    setSeverityFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const isFiltersActive =
    departmentFilter !== 'all' ||
    severityFilter !== 'all' ||
    statusFilter !== 'all' ||
    Boolean(searchQuery.trim());

  // KPI Overview Counts
  const totalCount = defects.length;
  const criticalCount = defects.filter((d) => d.defect_severity?.toLowerCase() === 'critical').length;
  const openCount = defects.filter((d) => d.status === 'open' || d.status !== 'closed').length;
  const closedCount = defects.filter((d) => d.status === 'closed').length;

  // DataGrid Column Definitions
  const columns = [
    {
      field: 'defect_id',
      headerName: 'Defect ID',
      width: 110,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.main' }}>
          DEF-{params.value}
        </Typography>
      ),
    },
    {
      field: 'asset_id',
      headerName: 'Asset ID',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={`AST-${params.value}`}
          size="small"
          variant="outlined"
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.2)',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        />
      ),
    },
    {
      field: 'department',
      headerName: 'Department',
      width: 130,
      renderCell: (params) => {
        const dept = params.value || '';
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
            label={dept}
            size="small"
            sx={{
              bgcolor: `${color}1a`,
              color,
              fontWeight: 700,
              fontSize: '0.75rem',
              border: `1px solid ${color}40`,
            }}
          />
        );
      },
    },
    {
      field: 'defect_type',
      headerName: 'Defect Type',
      flex: 1,
      minWidth: 170,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
          <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
            {params.value}
          </Typography>
          {params.row.detected_by && (
            <Typography variant="caption" color="text.secondary">
              By: {params.row.detected_by}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'defect_severity',
      headerName: 'Severity',
      width: 140,
      renderCell: (params) => {
        const sev = (params.value || 'observational').toLowerCase();
        const conf = SEVERITY_COLOR_MAP[sev] || SEVERITY_COLOR_MAP.observational;
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
              textTransform: 'uppercase',
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
        const status = (params.value || 'open').toLowerCase();
        let chipColor = 'default';
        let label = status;

        if (status === 'open' || status === 'acknowledged') {
          chipColor = 'warning';
          label = 'Open';
        } else if (status === 'in_progress') {
          chipColor = 'primary';
          label = 'In Progress';
        } else if (status === 'closed') {
          chipColor = 'success';
          label = 'Closed';
        }

        return (
          <Chip
            label={label}
            size="small"
            color={chipColor}
            variant="filled"
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'capitalize',
            }}
          />
        );
      },
    },
    {
      field: 'detected_date',
      headerName: 'Detected Date',
      width: 130,
      valueFormatter: (value) => value || '-',
    },
    {
      field: 'recommended_action',
      headerName: 'Recommended Action',
      flex: 1.2,
      minWidth: 220,
      renderCell: (params) => (
        <Tooltip title={params.value || ''}>
          <Typography
            variant="body2"
            noWrap
            sx={{ color: 'text.secondary', fontSize: '0.85rem' }}
          >
            {params.value || '-'}
          </Typography>
        </Tooltip>
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
            Track & Asset Defect Registry
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Comprehensive safety defect records, severity scoring, and remedial possession demands
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Defect Registry">
            <span>
              <IconButton
                onClick={fetchDefects}
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
              setDialogError(null);
              setFormData(getInitialDefectForm());
              setOpenDialog(true);
            }}
            sx={{
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(78, 168, 222, 0.3)',
            }}
          >
            Create Defect
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
                  <BugReportIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    TOTAL DEFECTS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {totalCount} Logged
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
              border: '1px solid rgba(244, 67, 54, 0.4)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(244, 67, 54, 0.16)',
                    color: '#f44336',
                    display: 'flex',
                  }}
                >
                  <WarningAmberIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    CRITICAL SEVERITY
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#f44336">
                    {criticalCount} Urgent
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
                    OPEN DEFECTS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {openCount} Pending
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
                    RESOLVED / CLOSED
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {closedCount} Rectified
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
            <Button color="inherit" size="small" onClick={fetchDefects}>
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

      {/* Filters Toolbar Card */}
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2.5,
          mb: 3,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          {/* Department Filter Dropdown */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="dept-filter-label">Department</InputLabel>
              <Select
                labelId="dept-filter-label"
                value={departmentFilter}
                label="Department"
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <MenuItem value="all">All Departments</MenuItem>
                {DEPARTMENTS.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    {dept}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Severity Filter Dropdown */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="severity-filter-label">Severity</InputLabel>
              <Select
                labelId="severity-filter-label"
                value={severityFilter}
                label="Severity"
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <MenuItem value="all">All Severities</MenuItem>
                {SEVERITIES.map((sev) => (
                  <MenuItem key={sev} value={sev} sx={{ textTransform: 'capitalize' }}>
                    {sev}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Status Filter Dropdown */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                {STATUSES.map((stat) => (
                  <MenuItem key={stat} value={stat} sx={{ textTransform: 'capitalize' }}>
                    {stat === 'in_progress' ? 'In Progress' : stat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Search Box */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search defects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              {isFiltersActive && (
                <Tooltip title="Reset all filters">
                  <IconButton onClick={resetFilters} color="secondary" sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <FilterAltOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* DataGrid Table Card */}
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Showing {filteredDefects.length} of {defects.length} Defects
          </Typography>
        </Box>

        <Box sx={{ height: 650, width: '100%' }}>
          <DataGrid
            rows={filteredDefects}
            columns={columns}
            getRowId={(row) => row.defect_id}
            loading={loading}
            checkboxSelection
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize: 100, page: 0 },
              },
              sorting: {
                sortModel: [{ field: 'defect_id', sort: 'desc' }],
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

      {/* Create Defect Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => !createLoading && setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider' }}>
          Report & Log Track Defect
        </DialogTitle>

        <form onSubmit={handleCreateSubmit}>
          <DialogContent sx={{ pt: 3 }}>
            {dialogError && (
              <Alert severity="error" sx={{ mb: 2.5 }}>
                {dialogError}
              </Alert>
            )}

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Target Asset ID"
                  value={formData.asset_id}
                  onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                  required
                  helperText="ID of the asset needing remediation"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                >
                  {DEPARTMENTS.map((dept) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 12 }}>
                <TextField
                  fullWidth
                  label="Defect Description / Type"
                  value={formData.defect_type}
                  onChange={(e) => setFormData({ ...formData, defect_type: e.target.value })}
                  required
                  placeholder="e.g. Rail Fracture, Thermit Weld Defect, Point Machine Sluggish"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Severity Level"
                  value={formData.defect_severity}
                  onChange={(e) => setFormData({ ...formData, defect_severity: e.target.value })}
                  required
                >
                  {SEVERITIES.map((sev) => (
                    <MenuItem key={sev} value={sev} sx={{ textTransform: 'capitalize' }}>
                      {sev}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  fullWidth
                  label="Initial Status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  required
                >
                  {STATUSES.map((stat) => (
                    <MenuItem key={stat} value={stat} sx={{ textTransform: 'capitalize' }}>
                      {stat === 'in_progress' ? 'In Progress' : stat}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="date"
                  label="Detected Date"
                  value={formData.detected_date}
                  onChange={(e) => setFormData({ ...formData, detected_date: e.target.value })}
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Detected By"
                  value={formData.detected_by}
                  onChange={(e) => setFormData({ ...formData, detected_by: e.target.value })}
                  required
                  placeholder="e.g. SSE/USFD, JE/Track"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Recommended Remedial Action"
                  value={formData.recommended_action}
                  onChange={(e) => setFormData({ ...formData, recommended_action: e.target.value })}
                  required
                  placeholder="e.g. Schedule emergency traffic block for cut and rail replacement"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Estimated Duration (Minutes)"
                  value={formData.estimated_work_duration_min}
                  onChange={(e) =>
                    setFormData({ ...formData, estimated_work_duration_min: e.target.value })
                  }
                  required
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Allowed Delay (Days)"
                  value={formData.max_allowed_delay_days}
                  onChange={(e) =>
                    setFormData({ ...formData, max_allowed_delay_days: e.target.value })
                  }
                  required
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              onClick={() => setOpenDialog(false)}
              disabled={createLoading}
              color="inherit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={createLoading}
              startIcon={createLoading ? <CircularProgress size={16} /> : <AddIcon />}
              sx={{ fontWeight: 700 }}
            >
              {createLoading ? 'Logging...' : 'Log Defect'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
