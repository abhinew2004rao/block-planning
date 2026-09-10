import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import EngineeringIcon from '@mui/icons-material/Engineering';
import BugReportIcon from '@mui/icons-material/BugReport';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TuneIcon from '@mui/icons-material/Tune';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import HubIcon from '@mui/icons-material/Hub';
import PieChartIcon from '@mui/icons-material/PieChart';
import BarChartIcon from '@mui/icons-material/BarChart';

// Recharts imports for responsive data visualization
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
} from 'recharts';

import api, { ASSETS, DEFECTS, TASKS, BLOCKS } from '../api/axios';

// Color definitions specified by requirements
const ASSET_TYPE_COLORS = {
  track: '#2196f3',    // Blue
  signal: '#4caf50',   // Green
  traction: '#ff9800', // Orange
};

const SEVERITY_COLORS = {
  critical: '#f44336',      // Red
  major: '#ff9800',         // Orange
  minor: '#fbc02d',         // Yellow
  observational: '#4caf50', // Green
};

const DEPARTMENT_COLORS = {
  'P.Way': '#2196f3',       // Engineering / Blue
  'Engineering': '#2196f3', // Engineering / Blue
  'TRD': '#ff9800',         // Traction / Orange
  'S&T': '#4caf50',         // Signals & Telecom / Green
  'Bridge': '#00bcd4',
  'Works': '#9c27b0',
};

// Custom dark-mode tooltip for Recharts
const CustomRechartsTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <Box
        sx={{
          bgcolor: '#131e3a',
          p: 1.5,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ color: '#f1f5f9' }}>
          {label || item.name}
        </Typography>
        <Typography variant="caption" sx={{ color: item.payload?.color || item.color || '#4ea8de', fontWeight: 600 }}>
          Count: {item.value}
          {item.payload?.percent !== undefined ? ` (${item.payload.percent}%)` : ''}
        </Typography>
      </Box>
    );
  }
  return null;
};

/**
 * Home Page Component for Indian Railways Block Planning Dashboard
 *
 * Requirements:
 * - Fetch data from API endpoints:
 *   * GET /assets (count total assets)
 *   * GET /defects (count open defects)
 *   * GET /tasks/backlog (count pending tasks)
 *   * GET /blocks (count planned blocks)
 * - Display 4 stat cards:
 *   * Total Assets (icon: Engineering, color: blue)
 *   * Open Defects (icon: BugReport, color: red)
 *   * Pending Tasks (icon: Assignment, color: orange)
 *   * Planned Blocks (icon: CalendarToday, color: green)
 * - Add charts below stat cards using Recharts:
 *   1. Assets by Type (Pie Chart) -> colors: blue, green, orange
 *   2. Defects by Severity (Bar Chart) -> colors: red, orange, yellow, green
 *   3. Tasks by Department (Pie Chart) -> colors by department
 * - Use Material-UI Grid and Card components
 * - Responsive layout
 * - Add loading state while fetching
 * - Add error handling
 * - Include last updated timestamp
 */
export default function Home() {
  const navigate = useNavigate();

  // Dashboard state
  const [counts, setCounts] = useState({
    totalAssets: 0,
    openDefects: 0,
    pendingTasks: 0,
    plannedBlocks: 0,
  });

  // Chart datasets
  const [assetsByType, setAssetsByType] = useState([]);
  const [defectsBySeverity, setDefectsBySeverity] = useState([]);
  const [tasksByDepartment, setTasksByDepartment] = useState([]);

  const [recentBlocks, setRecentBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [scoringMsg, setScoringMsg] = useState(null);

  // Fetch all dashboard data concurrently
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [assetsRes, defectsRes, tasksBacklogRes, blocksRes, allTasksRes] = await Promise.all([
        api.get(ASSETS),
        api.get(DEFECTS),
        api.get(`${TASKS}/backlog`),
        api.get(BLOCKS),
        api.get(TASKS),
      ]);

      const assetsList = Array.isArray(assetsRes.data) ? assetsRes.data : [];
      const defectsList = Array.isArray(defectsRes.data) ? defectsRes.data : [];
      const tasksBacklogList = Array.isArray(tasksBacklogRes.data) ? tasksBacklogRes.data : [];
      const blocksList = Array.isArray(blocksRes.data) ? blocksRes.data : [];
      const allTasksList = Array.isArray(allTasksRes.data) ? allTasksRes.data : tasksBacklogList;

      // 1. Stat Card Counts
      const totalAssets = assetsList.length;
      const openDefects = defectsList.filter(
        (d) => d.status === 'open' || (d.status && d.status !== 'closed')
      ).length;
      const pendingTasks = tasksBacklogList.filter(
        (t) => t.status === 'pending'
      ).length || tasksBacklogList.length;
      const plannedBlocks = blocksList.filter(
        (b) => b.status === 'planned'
      ).length || blocksList.length;

      setCounts({
        totalAssets,
        openDefects,
        pendingTasks,
        plannedBlocks,
      });

      // 2. Chart 1: Assets by Type (Pie Chart) -> group by asset_type
      const assetTypeCounts = { track: 0, signal: 0, traction: 0 };
      let totalAssetCount = 0;
      assetsList.forEach((asset) => {
        const type = (asset.asset_type || '').toLowerCase();
        if (assetTypeCounts[type] !== undefined) {
          assetTypeCounts[type]++;
        } else {
          assetTypeCounts[type] = (assetTypeCounts[type] || 0) + 1;
        }
        totalAssetCount++;
      });

      const formattedAssetsByType = Object.keys(assetTypeCounts)
        .filter((type) => assetTypeCounts[type] > 0)
        .map((type) => {
          const val = assetTypeCounts[type];
          const pct = totalAssetCount > 0 ? ((val / totalAssetCount) * 100).toFixed(1) : 0;
          return {
            name: type.charAt(0).toUpperCase() + type.slice(1),
            value: val,
            percent: Number(pct),
            color: ASSET_TYPE_COLORS[type] || '#4ea8de',
          };
        });
      setAssetsByType(formattedAssetsByType);

      // 3. Chart 2: Defects by Severity (Bar Chart) -> critical, major, minor, observational
      const severityCounts = {
        critical: 0,
        major: 0,
        minor: 0,
        observational: 0,
      };
      defectsList.forEach((defect) => {
        const sev = (defect.defect_severity || '').toLowerCase();
        if (severityCounts[sev] !== undefined) {
          severityCounts[sev]++;
        } else {
          severityCounts[sev] = 1;
        }
      });

      const formattedDefectsBySeverity = [
        { name: 'Critical', key: 'critical', count: severityCounts.critical, color: SEVERITY_COLORS.critical },
        { name: 'Major', key: 'major', count: severityCounts.major, color: SEVERITY_COLORS.major },
        { name: 'Minor', key: 'minor', count: severityCounts.minor, color: SEVERITY_COLORS.minor },
        { name: 'Observational', key: 'observational', count: severityCounts.observational, color: SEVERITY_COLORS.observational },
      ];
      setDefectsBySeverity(formattedDefectsBySeverity);

      // 4. Chart 3: Tasks by Department (Pie Chart) -> group by department
      const deptCounts = {};
      let totalTaskCount = 0;
      allTasksList.forEach((task) => {
        const dept = task.department || 'Other';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        totalTaskCount++;
      });

      const formattedTasksByDept = Object.keys(deptCounts).map((dept) => {
        const val = deptCounts[dept];
        const pct = totalTaskCount > 0 ? ((val / totalTaskCount) * 100).toFixed(1) : 0;
        return {
          name: dept === 'P.Way' ? 'Engineering (P.Way)' : dept,
          value: val,
          percent: Number(pct),
          color: DEPARTMENT_COLORS[dept] || '#4ea8de',
        };
      });
      setTasksByDepartment(formattedTasksByDept);

      // Recent Blocks
      setRecentBlocks(blocksList.slice(0, 5));

      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
      setError(err.message || 'Failed to fetch dashboard statistics from server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handler for quick ML scoring trigger
  const handleScoreTasks = async () => {
    setScoringLoading(true);
    setScoringMsg(null);
    try {
      const res = await api.post(`${TASKS}/score?update_status=true`);
      setScoringMsg(`Successfully scored ${res.data?.tasks_scored || 0} backlog tasks!`);
      await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to execute ML task scoring');
    } finally {
      setScoringLoading(false);
    }
  };

  // Stat cards metadata
  const statCards = [
    {
      title: 'Total Assets',
      value: counts.totalAssets,
      icon: <EngineeringIcon sx={{ fontSize: 32 }} />,
      color: '#2196f3', // Blue
      bgColor: 'rgba(33, 150, 243, 0.12)',
      borderColor: 'rgba(33, 150, 243, 0.3)',
      subtitle: 'Monitored Track, Signal & Traction Assets',
      path: '/assets',
    },
    {
      title: 'Open Defects',
      value: counts.openDefects,
      icon: <BugReportIcon sx={{ fontSize: 32 }} />,
      color: '#f44336', // Red
      bgColor: 'rgba(244, 67, 54, 0.12)',
      borderColor: 'rgba(244, 67, 54, 0.3)',
      subtitle: 'Pending Remediation & Safety Clearance',
      path: '/defects',
    },
    {
      title: 'Pending Tasks',
      value: counts.pendingTasks,
      icon: <AssignmentIcon sx={{ fontSize: 32 }} />,
      color: '#ff9800', // Orange
      bgColor: 'rgba(255, 152, 0, 0.12)',
      borderColor: 'rgba(255, 152, 0, 0.3)',
      subtitle: 'Corridor Maintenance Backlog',
      path: '/tasks',
    },
    {
      title: 'Planned Blocks',
      value: counts.plannedBlocks,
      icon: <CalendarTodayIcon sx={{ fontSize: 32 }} />,
      color: '#4caf50', // Green
      bgColor: 'rgba(76, 175, 80, 0.12)',
      borderColor: 'rgba(76, 175, 80, 0.3)',
      subtitle: 'Scheduled Corridor Traffic Windows',
      path: '/blocks',
    },
  ];

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Header Banner */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: -0.5,
              fontSize: { xs: '1.5rem', sm: '1.9rem', md: '2.2rem' },
              color: 'text.primary',
            }}
          >
            Corridor Operations Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Real-time track asset monitoring, defect mitigation, and corridor block planning
          </Typography>
        </Box>

        {/* Timestamp and Refresh Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {lastUpdated && (
            <Chip
              icon={<AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary !important' }} />}
              label={`Updated: ${lastUpdated}`}
              size="small"
              variant="outlined"
              sx={{
                borderColor: 'divider',
                color: 'text.secondary',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            />
          )}

          <Tooltip title="Refresh Dashboard Data">
            <span>
              <IconButton
                onClick={fetchDashboardData}
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
            color="secondary"
            startIcon={<TuneIcon />}
            onClick={() => navigate('/optimization')}
            sx={{
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(244, 162, 97, 0.3)',
            }}
          >
            Run Optimizer
          </Button>
        </Box>
      </Box>

      {/* Error Alert with Retry */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={fetchDashboardData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Success Notification for ML scoring */}
      {scoringMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setScoringMsg(null)}>
          {scoringMsg}
        </Alert>
      )}

      {/* Loading State Spinner */}
      {loading && !counts.totalAssets && !counts.openDefects ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '280px',
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            p: 4,
            mb: 4,
          }}
        >
          <CircularProgress size={52} sx={{ color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" fontWeight={600} color="text.primary">
            Fetching Corridor Statistics...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Querying assets, open defects, backlog tasks, and planned blocks
          </Typography>
        </Box>
      ) : (
        <>
          {/* 4 Stat Cards: Responsive layout (4 cols desktop, 2 tablet, 1 mobile) */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            {statCards.map((card) => (
              <Grid
                size={{ xs: 12, sm: 6, md: 3 }}
                key={card.title}
              >
                <Card
                  className="hover-card"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid',
                    borderColor: card.borderColor,
                    borderRadius: 3,
                    bgcolor: 'background.paper',
                    transition: 'all 0.25s ease-in-out',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: `0 8px 24px ${card.bgColor}`,
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => navigate(card.path)}
                    sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 2,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: 'text.secondary',
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          fontSize: '0.78rem',
                        }}
                      >
                        {card.title}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 50,
                          height: 50,
                          borderRadius: 2.5,
                          backgroundColor: card.bgColor,
                          color: card.color,
                        }}
                      >
                        {card.icon}
                      </Box>
                    </Box>

                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 800,
                        fontFamily: '"Outfit", sans-serif',
                        color: 'text.primary',
                        lineHeight: 1,
                        mb: 1.5,
                      }}
                    >
                      {loading ? '...' : card.value.toLocaleString()}
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.78rem',
                        display: 'block',
                        mb: 2,
                        flexGrow: 1,
                      }}
                    >
                      {card.subtitle}
                    </Typography>

                    <Divider sx={{ my: 1, borderColor: 'divider' }} />

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pt: 0.5,
                        color: card.color,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700}>
                        View Details
                      </Typography>
                      <ArrowForwardIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Recharts Data Visualizations Section */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Chart 1: Assets by Type (Pie Chart) */}
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card
                sx={{
                  p: 2.5,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <PieChartIcon sx={{ color: '#2196f3' }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                      Assets by Type
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Percentage distribution across tracks, signals & traction
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: 2, borderColor: 'divider' }} />

                <Box sx={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assetsByType}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ percent, value }) =>
                          typeof percent === 'number'
                            ? `${(percent > 1 ? percent : percent * 100).toFixed(0)}%`
                            : `${value}`
                        }
                        labelLine={false}
                      >
                        {assetsByType.map((entry, index) => (
                          <Cell key={`asset-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomRechartsTooltip />} />
                      <RechartsLegend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>

            {/* Chart 2: Defects by Severity (Bar Chart) */}
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card
                sx={{
                  p: 2.5,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <BarChartIcon sx={{ color: '#f44336' }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                      Defects by Severity
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Active defect counts (critical, major, minor, observational)
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: 2, borderColor: 'divider' }} />

                <Box sx={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={defectsBySeverity} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={11}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                      <RechartsTooltip content={<CustomRechartsTooltip />} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {defectsBySeverity.map((entry, index) => (
                          <Cell key={`defect-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>

            {/* Chart 3: Tasks by Department (Pie Chart) */}
            <Grid size={{ xs: 12, md: 12, lg: 4 }}>
              <Card
                sx={{
                  p: 2.5,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <PieChartIcon sx={{ color: '#4caf50' }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                      Tasks by Department
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Corridor maintenance share (Engineering, TRD, S&T)
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: 2, borderColor: 'divider' }} />

                <Box sx={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tasksByDepartment}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ percent, value }) =>
                          typeof percent === 'number'
                            ? `${(percent > 1 ? percent : percent * 100).toFixed(0)}%`
                            : `${value}`
                        }
                        labelLine={false}
                      >
                        {tasksByDepartment.map((entry, index) => (
                          <Cell key={`dept-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomRechartsTooltip />} />
                      <RechartsLegend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Grid>
          </Grid>

          {/* Quick Actions & Decision Support Bar */}
          <Paper
            sx={{
              p: 3,
              mb: 4,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              background: 'linear-gradient(135deg, rgba(78, 168, 222, 0.08) 0%, rgba(244, 162, 97, 0.08) 100%)',
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700} color="text.primary">
                ML Priority Scoring & Optimization Engine
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Compute urgency scores based on defect severity, line traffic density, and failure probabilities.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AutoFixHighIcon />}
                onClick={handleScoreTasks}
                disabled={scoringLoading}
                sx={{ fontWeight: 600 }}
              >
                {scoringLoading ? 'Scoring...' : 'Score Backlog Tasks'}
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SpeedIcon />}
                onClick={() => navigate('/optimization')}
                sx={{ fontWeight: 600 }}
              >
                Optimize Corridor Blocks
              </Button>
            </Box>
          </Paper>

          {/* Recent Blocks Table */}
          <Paper
            sx={{
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                p: 2.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <HubIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700} color="text.primary">
                  Recent Corridor Maintenance Blocks
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/blocks')}
                sx={{ fontWeight: 600 }}
              >
                All Blocks
              </Button>
            </Box>

            {recentBlocks.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No scheduled corridor blocks found. Run the optimizer to generate blocks.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="medium">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Block ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Section</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date & Window</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>KM Range</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Departments</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentBlocks.map((blk) => (
                      <TableRow key={blk.block_id || blk.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          #{blk.block_id || blk.id}
                        </TableCell>
                        <TableCell>{blk.section_code || 'NCR-SEC'}</TableCell>
                        <TableCell>
                          {blk.block_date || 'Upcoming'}
                          {blk.start_time && ` (${blk.start_time} - ${blk.end_time})`}
                        </TableCell>
                        <TableCell>
                          KM {blk.start_km ?? 0} - {blk.end_km ?? 0}
                        </TableCell>
                        <TableCell>{blk.duration_min || blk.allocated_duration_min || 0} min</TableCell>
                        <TableCell>
                          {Array.isArray(blk.departments_involved) ? (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {blk.departments_involved.map((dept) => (
                                <Chip key={dept} label={dept} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                              ))}
                            </Box>
                          ) : (
                            blk.department || 'Multi-Dept'
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={blk.status || 'planned'}
                            size="small"
                            color={
                              blk.status === 'approved'
                                ? 'success'
                                : blk.status === 'completed'
                                ? 'info'
                                : 'warning'
                            }
                            sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
