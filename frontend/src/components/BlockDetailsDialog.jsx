import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HubIcon from '@mui/icons-material/Hub';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import api, { BLOCKS } from '../api/axios';

/**
 * Helper to compute train impact color, label, and chip styles.
 * low = green (#4caf50)
 * medium = orange (#ff9800)
 * high = red (#f44336)
 */
const getTrainImpactDetails = (val) => {
  if (typeof val === 'string') {
    const s = val.toLowerCase();
    if (s === 'low') {
      return {
        label: 'Low Impact',
        color: '#4caf50',
        bgcolor: 'rgba(76, 175, 80, 0.16)',
        border: '1px solid rgba(76, 175, 80, 0.4)',
      };
    }
    if (s === 'medium') {
      return {
        label: 'Medium Impact',
        color: '#ff9800',
        bgcolor: 'rgba(255, 152, 0, 0.16)',
        border: '1px solid rgba(255, 152, 0, 0.4)',
      };
    }
    if (s === 'high') {
      return {
        label: 'High Impact',
        color: '#f44336',
        bgcolor: 'rgba(244, 67, 54, 0.16)',
        border: '1px solid rgba(244, 67, 54, 0.4)',
      };
    }
  }

  const num = Number(val) || 0;
  if (num >= 60) {
    return {
      label: `High Impact (${num.toFixed(1)})`,
      color: '#f44336', // Red
      bgcolor: 'rgba(244, 67, 54, 0.16)',
      border: '1px solid rgba(244, 67, 54, 0.4)',
    };
  }
  if (num >= 30) {
    return {
      label: `Medium Impact (${num.toFixed(1)})`,
      color: '#ff9800', // Orange
      bgcolor: 'rgba(255, 152, 0, 0.16)',
      border: '1px solid rgba(255, 152, 0, 0.4)',
    };
  }
  return {
    label: `Low Impact (${num.toFixed(1)})`,
    color: '#4caf50', // Green
    bgcolor: 'rgba(76, 175, 80, 0.16)',
    border: '1px solid rgba(76, 175, 80, 0.4)',
  };
};

/**
 * Helper to determine department styling.
 */
const getDepartmentStyle = (dept) => {
  const d = String(dept || '').toUpperCase();
  if (d.includes('WAY') || d.includes('P.WAY') || d.includes('ENGINEERING')) {
    return { color: '#2196f3', bgcolor: 'rgba(33, 150, 243, 0.15)', border: '1px solid rgba(33, 150, 243, 0.4)' };
  }
  if (d.includes('S&T') || d.includes('SIGNAL')) {
    return { color: '#4caf50', bgcolor: 'rgba(76, 175, 80, 0.15)', border: '1px solid rgba(76, 175, 80, 0.4)' };
  }
  if (d.includes('TRD') || d.includes('TRACTION')) {
    return { color: '#ff9800', bgcolor: 'rgba(255, 152, 0, 0.15)', border: '1px solid rgba(255, 152, 0, 0.4)' };
  }
  return { color: '#9c27b0', bgcolor: 'rgba(156, 39, 176, 0.15)', border: '1px solid rgba(156, 39, 176, 0.4)' };
};

/**
 * Helper for status badge styling.
 */
const getStatusBadge = (status) => {
  const s = String(status || 'planned').toLowerCase();
  if (s === 'approved') return { label: 'Approved', color: 'success', variant: 'filled' };
  if (s === 'in_progress') return { label: 'In Progress', color: 'info', variant: 'filled' };
  if (s === 'completed') return { label: 'Completed', color: 'default', variant: 'outlined' };
  return { label: 'Planned', color: 'warning', variant: 'filled' };
};

/**
 * BlockDetailsDialog Component
 *
 * Requirements:
 * - Fetch block details from GET /blocks/{block_id}
 * - Fetch tasks from GET /blocks/{block_id}/tasks
 * - Display:
 *   * Block info (date, time, section, type)
 *   * List of tasks (task_id, department, duration, sequence)
 *   * Departments involved
 *   * Train impact estimate
 * - Material-UI Dialog
 * - Close button
 * - Responsive
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is visible
 * @param {number|string|null} props.blockId - The ID of the block to inspect
 * @param {Object|null} [props.initialBlock] - Optional pre-loaded block data
 * @param {Function} props.onClose - Dialog close callback
 * @param {Function} [props.onBlockUpdated] - Callback after status change (e.g. approved)
 */
export default function BlockDetailsDialog({
  open = false,
  blockId = null,
  initialBlock = null,
  onClose,
  onBlockUpdated,
}) {
  const [block, setBlock] = useState(initialBlock);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const activeBlockId = blockId || initialBlock?.block_id;

  // Fetch block details and assigned tasks concurrently
  const fetchBlockDetailsAndTasks = useCallback(async () => {
    if (!activeBlockId) return;

    setLoading(true);
    setError(null);
    setActionSuccess(null);

    try {
      // Concurrently fetch GET /blocks/{block_id} and GET /blocks/{block_id}/tasks
      const [blockRes, tasksRes] = await Promise.all([
        api.get(`${BLOCKS}/${activeBlockId}`),
        api.get(`${BLOCKS}/${activeBlockId}/tasks`),
      ]);

      setBlock(blockRes.data || null);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
    } catch (err) {
      console.error(`Error fetching block #${activeBlockId} details:`, err);
      setError(err.message || `Failed to fetch block details for ID ${activeBlockId}`);
      // Fallback to initialBlock if available
      if (initialBlock) {
        setBlock(initialBlock);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBlockId, initialBlock]);

  // Trigger data fetching when dialog opens with a valid blockId
  useEffect(() => {
    if (open && activeBlockId) {
      fetchBlockDetailsAndTasks();
    } else if (!open) {
      // Clear transient messages on close
      setError(null);
      setActionSuccess(null);
    }
  }, [open, activeBlockId, fetchBlockDetailsAndTasks]);

  // Handle block approval action
  const handleApprove = async () => {
    if (!activeBlockId) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.put(`${BLOCKS}/${activeBlockId}/status`, { status: 'approved' });
      setBlock((prev) => ({ ...prev, ...(res.data || {}), status: 'approved' }));
      setActionSuccess(`Block #BLK-${activeBlockId} has been successfully approved!`);
      if (typeof onBlockUpdated === 'function') {
        onBlockUpdated(activeBlockId, 'approved');
      }
    } catch (err) {
      console.error(`Failed to approve block #${activeBlockId}:`, err);
      setError(err.message || `Failed to approve block #${activeBlockId}`);
    } finally {
      setActionLoading(false);
    }
  };

  const impactInfo = getTrainImpactDetails(block?.estimated_train_impact);
  const statusInfo = getStatusBadge(block?.status);
  const departments = Array.isArray(block?.departments_involved) ? block.departments_involved : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      aria-labelledby="block-details-dialog-title"
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Dialog Header */}
      <DialogTitle
        id="block-details-dialog-title"
        sx={{
          py: 2,
          px: { xs: 2, sm: 3 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.02)',
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
            <EventAvailableIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2 }}
            >
              Corridor Block #{activeBlockId ? `BLK-${activeBlockId}` : 'Details'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
              {block?.section_code ? `${block.section_code} Section` : 'Corridor Possession'}
              {block?.corridor_id ? ` • ${block.corridor_id}` : ''}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Reload Block Details">
            <span>
              <IconButton
                onClick={fetchBlockDetailsAndTasks}
                disabled={loading}
                size="small"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                <RefreshIcon fontSize="small" className={loading ? 'spinning-refresh' : ''} />
              </IconButton>
            </span>
          </Tooltip>

          <IconButton
            onClick={onClose}
            size="small"
            aria-label="close dialog"
            sx={{
              color: 'text.secondary',
              '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Dialog Content */}
      <DialogContent sx={{ p: { xs: 2, sm: 3 }, minHeight: 280 }}>
        {/* Alerts for feedback */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2.5 }}
            action={
              <Button color="inherit" size="small" onClick={fetchBlockDetailsAndTasks}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {actionSuccess && (
          <Alert severity="success" sx={{ mb: 2.5 }} onClose={() => setActionSuccess(null)}>
            {actionSuccess}
          </Alert>
        )}

        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              gap: 2,
            }}
          >
            <CircularProgress size={36} color="primary" />
            <Typography variant="body2" color="text.secondary">
              Fetching block parameters and packed maintenance tasks...
            </Typography>
          </Box>
        ) : block ? (
          <Box>
            {/* 1. Primary Block Info Grid */}
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: 2.5,
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Grid container spacing={2.5}>
                {/* Block Date */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    BLOCK DATE
                  </Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ color: 'text.primary', mt: 0.4 }}>
                    {block.block_date || 'N/A'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Scheduled Possession
                  </Typography>
                </Grid>

                {/* Time Window */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    TIME WINDOW
                  </Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ color: 'primary.light', mt: 0.4 }}>
                    {block.start_time ? String(block.start_time).slice(0, 5) : '--:--'} –{' '}
                    {block.end_time ? String(block.end_time).slice(0, 5) : '--:--'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Duration: <strong>{block.duration_min || 0} min</strong> ({((block.duration_min || 0) / 60).toFixed(1)} hrs)
                  </Typography>
                </Grid>

                {/* Section Code & Chainage */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    SECTION & CHAINAGE
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
                    <Chip
                      label={block.section_code || 'N/A'}
                      size="small"
                      sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)', fontWeight: 700 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                    KM {Number(block.km_start || 0).toFixed(2)} – {Number(block.km_end || 0).toFixed(2)}
                  </Typography>
                </Grid>

                {/* Block Type & Status */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
                    BLOCK TYPE & STATUS
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={block.block_type || 'General'}
                      size="small"
                      variant="outlined"
                      color={
                        String(block.block_type).toLowerCase() === 'power'
                          ? 'secondary'
                          : String(block.block_type).toLowerCase() === 'caution'
                          ? 'warning'
                          : 'info'
                      }
                      sx={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.75rem' }}
                    />
                    <Chip
                      label={statusInfo.label}
                      size="small"
                      color={statusInfo.color}
                      variant={statusInfo.variant}
                      sx={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.75rem' }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* 2. Departments Involved & Train Impact Row */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              {/* Departments Involved */}
              <Grid size={{ xs: 12, sm: 7 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    height: '100%',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    sx={{ letterSpacing: 0.5, display: 'block', mb: 1 }}
                  >
                    DEPARTMENTS INVOLVED ({departments.length})
                  </Typography>
                  {departments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No specific departments designated.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {departments.map((dept) => {
                        const style = getDepartmentStyle(dept);
                        return (
                          <Chip
                            key={dept}
                            label={dept}
                            size="small"
                            sx={{
                              bgcolor: style.bgcolor,
                              color: style.color,
                              border: style.border,
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              height: 26,
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Grid>

              {/* Train Impact Estimate */}
              <Grid size={{ xs: 12, sm: 5 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    height: '100%',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                    sx={{ letterSpacing: 0.5, display: 'block', mb: 1 }}
                  >
                    TRAIN IMPACT ESTIMATE
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Chip
                      label={impactInfo.label}
                      sx={{
                        color: impactInfo.color,
                        bgcolor: impactInfo.bgcolor,
                        border: impactInfo.border,
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        height: 28,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {impactInfo.label.includes('Low')
                        ? 'Minimal corridor delay'
                        : impactInfo.label.includes('Medium')
                        ? 'Moderate traffic regulation'
                        : 'Significant speed/line restriction'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5, borderColor: 'divider' }} />

            {/* 3. List of Tasks Assigned to this Block */}
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1.5,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HubIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                    Assigned Maintenance Tasks ({tasks.length})
                  </Typography>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Packed task schedule within this traffic possession window
                </Typography>
              </Box>

              {tasks.length === 0 ? (
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: 2,
                    bgcolor: 'rgba(78, 168, 222, 0.08)',
                    color: 'text.secondary',
                  }}
                >
                  No maintenance tasks have been packed into this corridor block yet. Use the Heuristic Optimizer to allocate pending work items.
                </Alert>
              ) : (
                <TableContainer
                  component={Paper}
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    bgcolor: 'background.paper',
                    overflowX: 'auto',
                  }}
                >
                  <Table size="small" aria-label="block tasks table">
                    <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, width: 90 }}>Sequence</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 130 }}>Task ID</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 140 }}>Department</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 120 }}>Duration</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Work Order / Scope</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tasks.map((t, idx) => {
                        const deptStyle = getDepartmentStyle(t.department);
                        const seq = t.sequence_order ?? idx + 1;
                        const duration = t.planned_duration_min ?? t.allocated_duration_min ?? t.duration_min ?? block.duration_min;
                        const taskId = t.task_id ?? t.id;

                        return (
                          <TableRow
                            key={t.id || t.block_task_id || `${taskId}-${idx}`}
                            hover
                            sx={{
                              '&:last-child td, &:last-child th': { border: 0 },
                              borderColor: 'rgba(255, 255, 255, 0.04)',
                            }}
                          >
                            {/* Sequence */}
                            <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  bgcolor: 'rgba(255, 255, 255, 0.06)',
                                  fontSize: '0.78rem',
                                }}
                              >
                                #{seq}
                              </Box>
                            </TableCell>

                            {/* Task ID */}
                            <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                              TSK-{taskId}
                            </TableCell>

                            {/* Department */}
                            <TableCell>
                              <Chip
                                label={t.department || 'N/A'}
                                size="small"
                                sx={{
                                  bgcolor: deptStyle.bgcolor,
                                  color: deptStyle.color,
                                  border: deptStyle.border,
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  height: 22,
                                }}
                              />
                            </TableCell>

                            {/* Duration */}
                            <TableCell sx={{ fontWeight: 600 }}>
                              {duration} min
                            </TableCell>

                            {/* Scope */}
                            <TableCell sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                              {t.work_order_no || 'Corridor Possessions Assignment'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        ) : (
          <Alert severity="warning" sx={{ my: 2 }}>
            No block details found for ID #{activeBlockId}.
          </Alert>
        )}
      </DialogContent>

      {/* Dialog Footer Actions */}
      <DialogActions
        sx={{
          py: 2,
          px: { xs: 2, sm: 3 },
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'space-between',
          bgcolor: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        <Box>
          {block?.status === 'planned' && (
            <Button
              variant="contained"
              color="success"
              startIcon={
                actionLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />
              }
              disabled={actionLoading}
              onClick={handleApprove}
              sx={{ fontWeight: 700 }}
            >
              {actionLoading ? 'Approving...' : 'Approve Block'}
            </Button>
          )}
        </Box>

        <Button
          onClick={onClose}
          color="inherit"
          variant="outlined"
          sx={{ fontWeight: 600, px: 2.5 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
