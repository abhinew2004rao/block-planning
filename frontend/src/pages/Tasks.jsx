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
  LinearProgress,
  Grid,
  Tooltip,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SpeedIcon from '@mui/icons-material/Speed';

import api, { TASKS } from '../api/axios';

// Priority Score Color Coding: High=Red, Medium=Orange, Low=Green
const getPriorityColorInfo = (score) => {
  const num = Number(score) || 0;
  if (num >= 70) {
    return {
      tier: 'High',
      color: '#f44336', // Red
      bgcolor: 'rgba(244, 67, 54, 0.16)',
      border: '1px solid rgba(244, 67, 54, 0.4)',
    };
  }
  if (num >= 40) {
    return {
      tier: 'Medium',
      color: '#ff9800', // Orange
      bgcolor: 'rgba(255, 152, 0, 0.16)',
      border: '1px solid rgba(255, 152, 0, 0.4)',
    };
  }
  return {
    tier: 'Low',
    color: '#4caf50', // Green
    bgcolor: 'rgba(76, 175, 80, 0.16)',
    border: '1px solid rgba(76, 175, 80, 0.4)',
  };
};

/**
 * Tasks Page Component for Indian Railways Block Planning System
 *
 * Requirements:
 * - Fetch tasks from GET /tasks?skip=0&limit=100
 * - Display in DataGrid
 * - Columns:
 *   * task_id
 *   * asset_id
 *   * department
 *   * task_type
 *   * priority_score (with color: high=red, medium=orange, low=green)
 *   * urgency_score
 *   * status (pending, scored, scheduled)
 *   * latest_end_date
 * - Add tabs:
 *   * All Tasks
 *   * Backlog (filter: status=pending)
 *   * Scheduled (filter: status=scheduled)
 * - Add "Run ML Scoring" button (POST /tasks/score)
 * - Show scoring progress
 * - Color-code priority scores
 */
export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(0);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Tab State: 'all', 'backlog', 'scheduled'
  const [activeTab, setActiveTab] = useState('all');

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${TASKS}?skip=0&limit=100`);
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch maintenance tasks:', err);
      setError(err.message || 'Error fetching maintenance task inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handle Run ML Scoring (POST /tasks/score)
  const handleRunScoring = async () => {
    setScoringLoading(true);
    setScoringProgress(15);
    setError(null);
    setSuccessMsg(null);

    // Simulate progressive telemetry while engine is scoring
    const progressInterval = setInterval(() => {
      setScoringProgress((prev) => (prev < 85 ? prev + 15 : prev));
    }, 250);

    try {
      const res = await api.post(`${TASKS}/score?update_status=true`);
      clearInterval(progressInterval);
      setScoringProgress(100);

      const count = res.data?.tasks_scored || 0;
      setSuccessMsg(
        `Machine Learning priority & urgency scoring completed! ${count} tasks evaluated and updated.`
      );
      await fetchTasks();
    } catch (err) {
      clearInterval(progressInterval);
      console.error('ML Scoring failed:', err);
      setError(err.message || 'Failed to execute machine learning task scoring');
    } finally {
      setTimeout(() => {
        setScoringLoading(false);
        setScoringProgress(0);
      }, 500);
    }
  };

  // Filter tasks based on Active Tab and Search
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Tab Filtering
      if (activeTab === 'backlog' && task.status !== 'pending') {
        return false;
      }
      if (activeTab === 'scheduled' && task.status !== 'scheduled') {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          String(task.task_id).includes(q) ||
          String(task.asset_id).includes(q) ||
          task.task_type?.toLowerCase().includes(q) ||
          task.department?.toLowerCase().includes(q) ||
          task.status?.toLowerCase().includes(q) ||
          task.section_code?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, activeTab, searchQuery]);

  // Tab count metrics
  const totalCount = tasks.length;
  const backlogCount = tasks.filter((t) => t.status === 'pending').length;
  const scheduledCount = tasks.filter((t) => t.status === 'scheduled').length;
  const scoredCount = tasks.filter((t) => t.status === 'scored').length;

  // DataGrid Column Definitions
  const columns = [
    {
      field: 'task_id',
      headerName: 'Task ID',
      width: 110,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700} sx={{ color: 'primary.main' }}>
          TSK-{params.value}
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
      field: 'task_type',
      headerName: 'Task Type',
      flex: 1,
      minWidth: 170,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}>
          <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.estimated_duration_min || 60} mins • Shift: {params.row.preferred_shift || 'any'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'priority_score',
      headerName: 'Priority Score',
      width: 160,
      renderCell: (params) => {
        const score = Number(params.value) || 0;
        const conf = getPriorityColorInfo(score);
        return (
          <Tooltip title={`Priority Score: ${score.toFixed(1)} / 100 (${conf.tier})`}>
            <Chip
              label={`${score.toFixed(1)} • ${conf.tier}`}
              size="small"
              sx={{
                bgcolor: conf.bgcolor,
                color: conf.color,
                border: conf.border,
                fontWeight: 800,
                fontSize: '0.75rem',
              }}
            />
          </Tooltip>
        );
      },
    },
    {
      field: 'urgency_score',
      headerName: 'Urgency Score',
      width: 140,
      type: 'number',
      renderCell: (params) => {
        const val = Number(params.value);
        const displayVal = !isNaN(val) ? val.toFixed(1) : '-';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: '#64dfdf' }}>
              {displayVal}
            </Typography>
            {!isNaN(val) && (
              <Box
                sx={{
                  width: 32,
                  height: 4,
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${Math.min(val, 100)}%`,
                    height: '100%',
                    bgcolor: '#64dfdf',
                  }}
                />
              </Box>
            )}
          </Box>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => {
        const status = (params.value || 'pending').toLowerCase();
        let color = 'default';
        let label = status;

        if (status === 'pending') {
          color = 'warning';
          label = 'Pending';
        } else if (status === 'scored') {
          color = 'info';
          label = 'Scored';
        } else if (status === 'scheduled') {
          color = 'success';
          label = 'Scheduled';
        }

        return (
          <Chip
            label={label}
            size="small"
            color={color}
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
      field: 'latest_end_date',
      headerName: 'Latest End Date',
      width: 140,
      valueFormatter: (value) => value || 'Flexible',
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
            Corridor Maintenance Tasks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            AI-driven priority scoring, heuristic failure risk evaluation, and possession backlog
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title="Refresh Task List">
            <span>
              <IconButton
                onClick={fetchTasks}
                disabled={loading || scoringLoading}
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

          {/* Run ML Scoring Button */}
          <Button
            variant="contained"
            color="primary"
            startIcon={
              scoringLoading ? <CircularProgress size={18} color="inherit" /> : <AutoFixHighIcon />
            }
            disabled={scoringLoading}
            onClick={handleRunScoring}
            sx={{
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(78, 168, 222, 0.35)',
              minWidth: 170,
            }}
          >
            {scoringLoading ? 'Scoring Tasks...' : 'Run ML Scoring'}
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
                  <AssignmentIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    TOTAL TASKS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {totalCount} Total
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
                    PENDING BACKLOG
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#ff9800">
                    {backlogCount} Pending
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
                    bgcolor: 'rgba(100, 223, 223, 0.12)',
                    color: '#64dfdf',
                    display: 'flex',
                  }}
                >
                  <SpeedIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    ML SCORED
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {scoredCount} Scored
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
                  <EventAvailableIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    SCHEDULED BLOCKS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {scheduledCount} Allocated
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
            <Button color="inherit" size="small" onClick={fetchTasks}>
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

      {/* Scoring Telemetry / Progress Bar */}
      {scoringLoading && (
        <Paper
          sx={{
            p: 2.5,
            mb: 3,
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'primary.main',
            boxShadow: '0 4px 20px rgba(78, 168, 222, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AutoFixHighIcon color="primary" />
              <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                Executing Machine Learning Heuristic Scoring Model...
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {scoringProgress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={scoringProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'primary.main',
                borderRadius: 4,
              },
            }}
          />
        </Paper>
      )}

      {/* DataGrid Card with Tabs Toolbar */}
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2.5,
        }}
      >
        {/* Navigation Tabs and Search Bar */}
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
          {/* Tabs: All Tasks, Backlog (pending), Scheduled (scheduled) */}
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
            <Tab label={`All Tasks (${totalCount})`} value="all" />
            <Tab label={`Backlog (${backlogCount})`} value="backlog" />
            <Tab label={`Scheduled (${scheduledCount})`} value="scheduled" />
          </Tabs>

          {/* Search Box */}
          <TextField
            size="small"
            placeholder="Search tasks by ID, type, dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: { xs: '100%', sm: 300 },
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

        {/* DataGrid Table */}
        <Box sx={{ height: 650, width: '100%' }}>
          <DataGrid
            rows={filteredTasks}
            columns={columns}
            getRowId={(row) => row.task_id}
            loading={loading}
            checkboxSelection
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize: 100, page: 0 },
              },
              sorting: {
                sortModel: [{ field: 'priority_score', sort: 'desc' }],
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
    </Box>
  );
}
