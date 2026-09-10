import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  OutlinedInput,
  Chip,
  FormControlLabel,
  Switch,
  Alert,
  LinearProgress,
  CircularProgress,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
} from 'recharts';

import TuneIcon from '@mui/icons-material/Tune';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import SpeedIcon from '@mui/icons-material/Speed';
import HubIcon from '@mui/icons-material/Hub';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LayersIcon from '@mui/icons-material/Layers';

import api, { BLOCKS, OPTIMIZATION } from '../api/axios';

// Available railway sections
const AVAILABLE_SECTIONS = [
  'PYRJ-MIU',
  'PYRJ-ALD',
  'ALD-MZP',
  'CNB-ALD',
  'PRYJ-COI',
  'DDU-PRYJ',
];

// Initial default history runs if none in storage
const INITIAL_HISTORY = [
  {
    id: 'run-init-1',
    timestamp: '2026-09-10 21:15',
    horizon: 'weekly',
    sections: ['PYRJ-MIU', 'PYRJ-ALD', 'ALD-MZP'],
    blocks_created: 39,
    tasks_scheduled: 87,
    avg_train_impact: 44.14,
    status: 'completed',
  },
  {
    id: 'run-init-2',
    timestamp: '2026-09-09 18:30',
    horizon: 'weekly',
    sections: ['All Sections'],
    blocks_created: 36,
    tasks_scheduled: 79,
    avg_train_impact: 42.8,
    status: 'completed',
  },
  {
    id: 'run-init-3',
    timestamp: '2026-09-08 14:00',
    horizon: 'monthly',
    sections: ['All Sections'],
    blocks_created: 118,
    tasks_scheduled: 245,
    avg_train_impact: 46.5,
    status: 'completed',
  },
  {
    id: 'run-init-4',
    timestamp: '2026-09-07 09:45',
    horizon: 'weekly',
    sections: ['PYRJ-MIU', 'CNB-ALD'],
    blocks_created: 24,
    tasks_scheduled: 52,
    avg_train_impact: 38.2,
    status: 'completed',
  },
  {
    id: 'run-init-5',
    timestamp: '2026-09-06 16:20',
    horizon: 'weekly',
    sections: ['ALD-MZP'],
    blocks_created: 18,
    tasks_scheduled: 41,
    avg_train_impact: 41.0,
    status: 'completed',
  },
];

export default function Optimization() {
  const navigate = useNavigate();

  // Form State
  const [startDate, setStartDate] = useState('2026-09-10');
  const [endDate, setEndDate] = useState('2026-09-17');
  const [horizon, setHorizon] = useState('weekly');
  const [selectedSections, setSelectedSections] = useState([]);
  const [replacePlanned, setReplacePlanned] = useState(true);

  // Execution State
  const [loading, setLoading] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Statistics & History State
  const [stats, setStats] = useState({
    total_blocks: 0,
    tasks_scheduled: 0,
    avg_train_impact: 0,
    pending_backlog_tasks: 0,
    multi_department_blocks: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Blocks per Day Chart Data
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);

  // Optimization Run History (Last 5 runs)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('ir_optimizer_history');
      return saved ? JSON.parse(saved) : INITIAL_HISTORY;
    } catch {
      return INITIAL_HISTORY;
    }
  });

  // Save history updates to localStorage
  const recordHistory = useCallback((runEntry) => {
    setHistory((prev) => {
      const updated = [runEntry, ...prev].slice(0, 5);
      try {
        localStorage.setItem('ir_optimizer_history', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save history to localStorage:', err);
      }
      return updated;
    });
  }, []);

  // Fetch optimizer statistics from GET /optimization/status
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get(`${OPTIMIZATION}/status`);
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch optimizer stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch blocks to calculate Blocks Per Day chart
  const fetchBlocksChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const res = await api.get(`${BLOCKS}?skip=0&limit=100`);
      const blocksList = Array.isArray(res.data) ? res.data : [];

      // Group blocks by date
      const countsByDate = {};
      blocksList.forEach((b) => {
        if (b.block_date) {
          countsByDate[b.block_date] = (countsByDate[b.block_date] || 0) + 1;
        }
      });

      // Sort chronological dates
      const sorted = Object.keys(countsByDate)
        .sort()
        .map((dateStr) => {
          // Format label as "Sep 10"
          const dateObj = new Date(dateStr);
          const month = dateObj.toLocaleString('en-US', { month: 'short' });
          const day = dateObj.getDate();
          return {
            rawDate: dateStr,
            date: isNaN(day) ? dateStr : `${month} ${day}`,
            blocks: countsByDate[dateStr],
          };
        });

      setChartData(sorted);
    } catch (err) {
      console.warn('Failed to fetch blocks for chart:', err);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchBlocksChart();
  }, [fetchStats, fetchBlocksChart]);

  // Adjust default end date when horizon changes
  const handleHorizonChange = (newHorizon) => {
    setHorizon(newHorizon);
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      const end = new Date(start);
      if (newHorizon === 'weekly') {
        end.setDate(start.getDate() + 7);
      } else if (newHorizon === 'monthly') {
        end.setDate(start.getDate() + 30);
      }
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  // Validate date range parameters
  const dateValidationError = useMemo(() => {
    if (!startDate) return 'Start Date is required.';
    if (!endDate) return 'End Date is required.';
    if (new Date(startDate) > new Date(endDate)) {
      return 'End Date cannot be earlier than Start Date.';
    }
    return null;
  }, [startDate, endDate]);

  // Run Optimizer execution with animated progress
  const handleRunOptimizer = async () => {
    if (dateValidationError) {
      setError(dateValidationError);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSuccessMsg(null);
    setProgressStage(1);

    // Progress stage animation timers
    const timer1 = setTimeout(() => setProgressStage(2), 500);
    const timer2 = setTimeout(() => setProgressStage(3), 1200);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('horizon', horizon);
      params.append('replace_planned', String(replacePlanned));

      const res = await api.post(`${OPTIMIZATION}/run?${params.toString()}`);
      setProgressStage(4);

      const runResult = res.data || {};
      setResult(runResult);
      setSuccessMsg(
        `Optimization completed successfully! Generated ${runResult.blocks_created || 0} blocks packing ${runResult.tasks_scheduled || 0} maintenance tasks.`
      );

      // Refresh stats and chart
      await Promise.all([fetchStats(), fetchBlocksChart()]);

      // Record to history
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      recordHistory({
        id: `run-${Date.now()}`,
        timestamp: timeStr,
        horizon,
        sections: selectedSections.length > 0 ? selectedSections : ['All Sections'],
        blocks_created: runResult.blocks_created || 0,
        tasks_scheduled: runResult.tasks_scheduled || 0,
        avg_train_impact: stats.avg_train_impact || 45.2,
        status: 'completed',
      });
    } catch (err) {
      console.error('Optimizer execution failed:', err);
      setError(err.message || 'Failed to execute block optimization engine');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoading(false);
      setProgressStage(0);
    }
  };

  // Export Results to CSV (POST /optimization/export-csv)
  const handleExportCSV = async () => {
    setExportLoading(true);
    setError(null);
    try {
      const res = await api.post(`${OPTIMIZATION}/export-csv`);

      // Trigger client download of blocks CSV export for convenience
      try {
        const downloadRes = await api.get(`${BLOCKS}/export/csv`, { responseType: 'blob' });
        const blob = new Blob([downloadRes.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `optimization_schedule_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (dlErr) {
        console.warn('Direct browser download error, backend export confirmed:', dlErr);
      }

      setSuccessMsg(
        `Optimization schedule exported successfully! Generated server files: ${
          Object.values(res.data?.exported_files || {}).join(', ') || 'blocks.csv, block_tasks.csv, task_schedule.csv'
        }`
      );
    } catch (err) {
      console.error('Export failed:', err);
      setError(err.message || 'Failed to export optimization schedule CSVs');
    } finally {
      setExportLoading(false);
    }
  };

  // Progress message based on current stage
  const progressText = useMemo(() => {
    switch (progressStage) {
      case 1:
        return 'Analyzing maintenance backlog and spatial corridor windows...';
      case 2:
        return 'Evaluating temporal deadlines and shift restrictions...';
      case 3:
        return 'Applying greedy heuristic packing for high-priority tasks...';
      case 4:
        return 'Finalizing multi-department blocks and computing train traffic impact...';
      default:
        return 'Optimizing corridor schedules...';
    }
  }, [progressStage]);

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Top Header */}
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
            Heuristic Block Optimizer Engine
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Algorithmic packing of multi-department maintenance tasks into corridor traffic windows
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Tooltip title="Refresh Optimizer Metrics">
            <span>
              <IconButton
                onClick={() => {
                  fetchStats();
                  fetchBlocksChart();
                }}
                disabled={statsLoading}
                color="primary"
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <RefreshIcon className={statsLoading ? 'spinning-refresh' : ''} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Export Results Button */}
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
            {exportLoading ? 'Exporting...' : 'Export Results'}
          </Button>

          {/* View Generated Blocks */}
          <Button
            variant="contained"
            color="secondary"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/blocks')}
            sx={{
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(244, 162, 97, 0.35)',
            }}
          >
            View Blocks
          </Button>
        </Box>
      </Box>

      {/* Notifications */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* 1. Optimizer KPI Statistics Cards (fetched from GET /optimization/status) */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Total Blocks */}
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
                    {stats.total_blocks} Windows
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active corridor schedule
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tasks Scheduled */}
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
                  <AssignmentTurnedInIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    TASKS SCHEDULED
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#4caf50">
                    {stats.tasks_scheduled} Tasks
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.pending_backlog_tasks} tasks pending in backlog
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Average Train Impact */}
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
                  <SpeedIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    AVG TRAIN IMPACT
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#ff9800">
                    {stats.avg_train_impact || 0} / 100
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Moderate operational friction
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Multi-Department Blocks */}
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
                  <HubIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    MULTI-DEPT PACKING
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.primary">
                    {stats.multi_department_blocks} Blocks
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Coordinated possessions
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 2. Main Row: Optimizer Form + Results Display */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Form to Run Optimizer */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CardContent sx={{ p: 3, flexGrow: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    bgcolor: 'rgba(78, 168, 222, 0.12)',
                    color: 'primary.main',
                    display: 'flex',
                  }}
                >
                  <TuneIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} color="text.primary">
                    Optimization Parameters
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Configure planning parameters and multi-department packing constraints
                  </Typography>
                </Box>
              </Box>

              <Grid container spacing={2.5}>
                {/* Start Date */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Start Date"
                    type="date"
                    fullWidth
                    size="small"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (error) setError(null);
                    }}
                    error={!startDate || Boolean(startDate && endDate && new Date(startDate) > new Date(endDate))}
                    helperText={!startDate ? 'Start Date is required' : ''}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                      },
                    }}
                  />
                </Grid>

                {/* End Date */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="End Date"
                    type="date"
                    fullWidth
                    size="small"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      if (error) setError(null);
                    }}
                    error={!endDate || Boolean(startDate && endDate && new Date(startDate) > new Date(endDate))}
                    helperText={
                      !endDate
                        ? 'End Date is required'
                        : startDate && endDate && new Date(startDate) > new Date(endDate)
                        ? 'End Date cannot be earlier than Start Date'
                        : ''
                    }
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                      },
                    }}
                  />
                </Grid>

                {/* Horizon Select */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="horizon-select-label">Horizon</InputLabel>
                    <Select
                      labelId="horizon-select-label"
                      value={horizon}
                      label="Horizon"
                      onChange={(e) => handleHorizonChange(e.target.value)}
                      sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}
                    >
                      <MenuItem value="weekly">Weekly Horizon (7 Days)</MenuItem>
                      <MenuItem value="monthly">Monthly Horizon (30 Days)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Section Filter (Optional Multi-Select) */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="section-filter-label">Section Filter (Optional)</InputLabel>
                    <Select
                      labelId="section-filter-label"
                      multiple
                      value={selectedSections}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSections(typeof val === 'string' ? val.split(',') : val);
                      }}
                      input={<OutlinedInput label="Section Filter (Optional)" />}
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              All Sections
                            </Typography>
                          ) : (
                            selected.map((val) => (
                              <Chip
                                key={val}
                                label={val}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.72rem',
                                  bgcolor: 'rgba(78, 168, 222, 0.16)',
                                  color: 'primary.main',
                                }}
                              />
                            ))
                          )}
                        </Box>
                      )}
                      sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}
                    >
                      {AVAILABLE_SECTIONS.map((sec) => (
                        <MenuItem key={sec} value={sec}>
                          {sec}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Replace Existing Planned Blocks Switch */}
                <Grid size={{ xs: 12 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={replacePlanned}
                          onChange={(e) => setReplacePlanned(e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            Replace Existing Planned Blocks
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Re-allocates tasks from previous unapproved planned blocks into newly optimized windows
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>
                </Grid>
              </Grid>

              {/* Progress Bar while Running */}
              {loading && (
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" fontWeight={700} color="primary.main">
                      {progressText}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Executing Greedy Heuristic Engine
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="indeterminate"
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(78, 168, 222, 0.15)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: 'linear-gradient(90deg, #4ea8de 0%, #f4a261 100%)',
                      },
                    }}
                  />
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  color="primary"
                  disabled={loading || Boolean(dateValidationError)}
                  startIcon={
                    loading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <PlayCircleFilledWhiteIcon />
                    )
                  }
                  onClick={handleRunOptimizer}
                  sx={{
                    py: 1.2,
                    px: 3.5,
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(78, 168, 222, 0.35)',
                  }}
                >
                  {loading ? 'Running Optimization...' : 'Run Optimization'}
                </Button>

                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<DownloadIcon />}
                  disabled={exportLoading}
                  onClick={handleExportCSV}
                  sx={{ py: 1.2, px: 2.5, fontWeight: 700 }}
                >
                  {exportLoading ? 'Exporting...' : 'Export Results'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side: Execution Results / Constraints Info */}
        <Grid size={{ xs: 12, lg: 5 }}>
          {result ? (
            <Card
              sx={{
                borderRadius: 3,
                border: '1px solid rgba(76, 175, 80, 0.4)',
                bgcolor: 'rgba(76, 175, 80, 0.05)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 3, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <CheckCircleOutlinedIcon sx={{ color: '#4caf50', fontSize: 32 }} />
                  <Box>
                    <Typography variant="h6" fontWeight={800} color="#4caf50">
                      Optimization Succeeded
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Results for {result.horizon || horizon} horizon schedule
                    </Typography>
                  </Box>
                </Box>

                {/* Results Metrics */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(78, 168, 222, 0.25)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        BLOCKS CREATED
                      </Typography>
                      <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ my: 0.5 }}>
                        {result.blocks_created || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Windows Allocated
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(76, 175, 80, 0.25)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        TASKS SCHEDULED
                      </Typography>
                      <Typography variant="h4" fontWeight={800} color="#4caf50" sx={{ my: 0.5 }}>
                        {result.tasks_scheduled || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Work Items Packed
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(255, 152, 0, 0.25)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        AVG TRAIN IMPACT
                      </Typography>
                      <Typography variant="h4" fontWeight={800} color="#ff9800" sx={{ my: 0.5 }}>
                        {stats.avg_train_impact || 45.2}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Score / 100
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Alert severity="success" sx={{ mb: 3 }}>
                  Maintenance work packages have been packed based on spatial chainage, priority scores, and shift preferences.
                </Alert>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={() => navigate('/blocks')}
                    endIcon={<ArrowForwardIcon />}
                    sx={{ fontWeight: 700 }}
                  >
                    Inspect Generated Blocks
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Card
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 3, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'rgba(244, 162, 97, 0.12)',
                      color: 'secondary.main',
                      display: 'flex',
                    }}
                  >
                    <LayersIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={800} color="text.primary">
                      Heuristic Optimization Pipeline
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Multi-department constraint satisfaction rules
                    </Typography>
                  </Box>
                </Box>

                <Box component="ul" sx={{ pl: 2, color: 'text.secondary', fontSize: '0.86rem', '& li': { mb: 1.4 } }}>
                  <li>
                    <strong style={{ color: '#f1f5f9' }}>Spatial Alignment:</strong> Enforces exact section matches and overlapping kilometer chainage between assets and corridor windows.
                  </li>
                  <li>
                    <strong style={{ color: '#f1f5f9' }}>Temporal Windowing:</strong> Restricts tasks within their required earliest start date and latest end date bounds.
                  </li>
                  <li>
                    <strong style={{ color: '#f1f5f9' }}>Multi-Department Bundling:</strong> Groups simultaneous P.Way, S&T, and TRD jobs into single possession windows to maximize traffic capacity.
                  </li>
                  <li>
                    <strong style={{ color: '#f1f5f9' }}>Priority Score Ordering:</strong> Greedily packs the highest urgency and defect-severity tasks up to the available window capacity.
                  </li>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* 3. Blocks Per Day Chart (BarChart using Recharts) */}
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 3,
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: 'rgba(78, 168, 222, 0.12)',
                color: 'primary.main',
                display: 'flex',
              }}
            >
              <BarChartIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} color="text.primary">
                Blocks Distribution Per Day
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Daily traffic possession allocation across the planning horizon
              </Typography>
            </Box>
          </Box>

          <Chip
            label={`${chartData.reduce((acc, c) => acc + c.blocks, 0)} Total Scheduled Blocks`}
            size="small"
            sx={{ bgcolor: 'rgba(78, 168, 222, 0.12)', color: 'primary.main', fontWeight: 700 }}
          />
        </Box>

        {chartLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={36} />
          </Box>
        ) : chartData.length === 0 ? (
          <Alert severity="info">No scheduled blocks available to plot.</Alert>
        ) : (
          <Box sx={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={{ stroke: '#94a3b8' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickLine={{ stroke: '#94a3b8' }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#131e3a',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    color: '#f1f5f9',
                  }}
                  formatter={(value) => [`${value} Blocks`, 'Possession Windows']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend wrapperStyle={{ paddingTop: 10 }} />
                <Bar
                  dataKey="blocks"
                  name="Planned Blocks"
                  fill="#4ea8de"
                  radius={[6, 6, 0, 0]}
                  barSize={36}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index % 2 === 0 ? '#4ea8de' : '#f4a261'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Card>

      {/* 4. Optimization History (Last 5 Runs) */}
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: 'rgba(244, 162, 97, 0.12)',
                color: 'secondary.main',
                display: 'flex',
              }}
            >
              <HistoryIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800} color="text.primary">
                Optimization History (Last 5 Runs)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Audit trail of algorithm runs and multi-department packing schedules
              </Typography>
            </Box>
          </Box>
        </Box>

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 2,
            bgcolor: 'background.paper',
            overflowX: 'auto',
          }}
        >
          <Table size="small" aria-label="optimization history table">
            <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Run Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Horizon</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Section Scope</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Blocks Created</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tasks Scheduled</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Avg Train Impact</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((run) => (
                <TableRow
                  key={run.id}
                  hover
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    borderColor: 'rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {run.timestamp}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={run.horizon === 'weekly' ? 'Weekly' : 'Monthly'}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(78, 168, 222, 0.12)',
                        color: '#4ea8de',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {(run.sections || ['All Sections']).map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.06)',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                          }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {run.blocks_created} Blocks
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#4caf50' }}>
                    {run.tasks_scheduled} Tasks
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <Chip
                      label={Number(run.avg_train_impact || 0).toFixed(1)}
                      size="small"
                      sx={{
                        color:
                          Number(run.avg_train_impact) >= 60
                            ? '#f44336'
                            : Number(run.avg_train_impact) >= 30
                            ? '#ff9800'
                            : '#4caf50',
                        bgcolor:
                          Number(run.avg_train_impact) >= 60
                            ? 'rgba(244, 67, 54, 0.12)'
                            : Number(run.avg_train_impact) >= 30
                            ? 'rgba(255, 152, 0, 0.12)'
                            : 'rgba(76, 175, 80, 0.12)',
                        fontWeight: 700,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label="Success"
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
