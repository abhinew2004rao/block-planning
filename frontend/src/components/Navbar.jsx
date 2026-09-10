import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Badge,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import TrainIcon from '@mui/icons-material/Train';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import api from '../api/axios';

/**
 * Navbar Component for Indian Railways Block Planning System
 *
 * Requirements:
 * - App Bar at top
 * - Logo/Title: "Indian Railways Block Planning"
 * - Right side: User profile icon, notifications icon
 * - Responsive (hamburger menu on mobile)
 * - Dark theme support
 * - Fixed position at top
 * - Height: 64px
 */
export default function Navbar({ toggleSidebar, onDrawerToggle }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDarkMode = theme.palette.mode === 'dark';

  // Toggle drawer handler for mobile responsiveness
  const handleToggle = toggleSidebar || onDrawerToggle;

  // Backend connection state
  const [backendStatus, setBackendStatus] = useState('checking');

  // Notifications menu state
  const [notificationsAnchor, setNotificationsAnchor] = useState(null);
  const isNotificationsOpen = Boolean(notificationsAnchor);

  // User profile menu state
  const [profileAnchor, setProfileAnchor] = useState(null);
  const isProfileOpen = Boolean(profileAnchor);

  // Mock notifications list
  const notifications = [
    {
      id: 1,
      title: 'Critical Track Defect',
      detail: 'KM 142.5 - 143.0 (Priority 94.2) requires urgent corridor block',
      time: '10m ago',
      critical: true,
    },
    {
      id: 2,
      title: 'Optimization Run Completed',
      detail: '7 corridor maintenance blocks scheduled for upcoming night windows',
      time: '35m ago',
      critical: false,
    },
    {
      id: 3,
      title: 'OHE Maintenance Confirmed',
      detail: 'Traction clearance granted for Section SEC-01',
      time: '1h ago',
      critical: false,
    },
  ];

  const checkHealth = async () => {
    try {
      const res = await api.get('/health');
      if (res.data?.status === 'healthy') {
        setBackendStatus('online');
      } else {
        setBackendStatus('degraded');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppBar
      position="fixed"
      elevation={2}
      sx={{
        height: '64px',
        top: 0,
        left: 0,
        right: 0,
        zIndex: (th) => th.zIndex.drawer + 1,
        backgroundColor: isDarkMode
          ? theme.palette.background.paper
          : '#0d3b66',
        color: isDarkMode ? theme.palette.text.primary : '#ffffff',
        borderBottom: isDarkMode
          ? `1px solid ${theme.palette.divider}`
          : '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isDarkMode
          ? '0 2px 8px rgba(0, 0, 0, 0.5)'
          : '0 2px 10px rgba(13, 59, 102, 0.25)',
      }}
    >
      <Toolbar
        sx={{
          minHeight: '64px !important',
          height: '64px',
          px: { xs: 1.5, sm: 2.5, md: 3 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left Side: Mobile Hamburger + Logo + Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
          {/* Hamburger Menu on mobile */}
          <IconButton
            color="inherit"
            edge="start"
            aria-label="open drawer"
            onClick={handleToggle}
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              mr: { xs: 0.5, sm: 1 },
              p: 1,
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Railways Crest / Logo Icon */}
          <Avatar
            variant="rounded"
            sx={{
              bgcolor: isDarkMode ? theme.palette.primary.main : '#f4a261',
              color: isDarkMode ? '#ffffff' : '#0d3b66',
              width: 38,
              height: 38,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            <TrainIcon sx={{ fontSize: 24 }} />
          </Avatar>

          {/* Branding Title */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="h6"
              component="div"
              noWrap
              sx={{
                fontFamily: '"Outfit", "Inter", sans-serif',
                fontWeight: 700,
                letterSpacing: 0.4,
                lineHeight: 1.2,
                fontSize: { xs: '0.95rem', sm: '1.15rem', md: '1.25rem' },
                color: isDarkMode ? theme.palette.text.primary : '#ffffff',
              }}
            >
              {isMobile ? 'IR Block Planning' : 'Indian Railways Block Planning'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: isDarkMode
                  ? theme.palette.text.secondary
                  : 'rgba(255, 255, 255, 0.72)',
                letterSpacing: 0.8,
                fontSize: { xs: '0.65rem', sm: '0.72rem' },
                textTransform: 'uppercase',
                fontWeight: 500,
                display: { xs: 'none', sm: 'block' },
              }}
            >
              Integrated Corridor Maintenance & Decision Support
            </Typography>
          </Box>
        </Box>

        {/* Right Side: Health Status + Notifications + Profile */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}>
          {/* Backend API Connection Chip */}
          <Tooltip title="Click to recheck FastAPI backend connection status">
            <Chip
              icon={
                backendStatus === 'online' ? (
                  <CheckCircleIcon sx={{ fontSize: 16, color: '#2a9d8f !important' }} />
                ) : (
                  <ErrorOutlinedIcon sx={{ fontSize: 16, color: '#e76f51 !important' }} />
                )
              }
              label={
                backendStatus === 'online'
                  ? 'API: Connected'
                  : backendStatus === 'checking'
                  ? 'Connecting...'
                  : 'API: Offline'
              }
              size="small"
              onClick={checkHealth}
              sx={{
                bgcolor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(255, 255, 255, 0.12)',
                color: isDarkMode ? theme.palette.text.primary : '#ffffff',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: { xs: 'none', md: 'inline-flex' },
                border: isDarkMode
                  ? `1px solid ${theme.palette.divider}`
                  : '1px solid rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  bgcolor: isDarkMode
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(255, 255, 255, 0.2)',
                },
              }}
            />
          </Tooltip>

          {/* Division Badge */}
          <Tooltip title="Operating Division">
            <Chip
              label="NCR / PRYJ"
              size="small"
              sx={{
                bgcolor: '#f4a261',
                color: '#1d2a44',
                fontWeight: 700,
                fontSize: '0.75rem',
                display: { xs: 'none', lg: 'inline-flex' },
              }}
            />
          </Tooltip>

          {/* Notifications Icon Button */}
          <Tooltip title="Notifications">
            <IconButton
              color="inherit"
              aria-label="show notifications"
              onClick={(e) => setNotificationsAnchor(e.currentTarget)}
              sx={{
                p: 1,
                color: isDarkMode ? theme.palette.text.primary : '#ffffff',
                '&:hover': {
                  bgcolor: isDarkMode
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.15)',
                },
              }}
            >
              <Badge badgeContent={notifications.length} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Notifications Dropdown Menu */}
          <Menu
            anchorEl={notificationsAnchor}
            open={isNotificationsOpen}
            onClose={() => setNotificationsAnchor(null)}
            onClick={() => setNotificationsAnchor(null)}
            PaperProps={{
              elevation: 4,
              sx: {
                width: 320,
                maxWidth: '100%',
                mt: 1.5,
                borderRadius: 2,
                overflow: 'visible',
                filter: 'drop-shadow(0px 4px 16px rgba(0,0,0,0.18))',
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Corridor Alerts & Notifications
              </Typography>
              <Chip label={`${notifications.length} New`} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
            </Box>
            <Divider />
            {notifications.map((notif) => (
              <MenuItem key={notif.id} sx={{ py: 1.2, px: 2, display: 'block', whiteSpace: 'normal' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                  <CircleIcon
                    sx={{
                      fontSize: 8,
                      color: notif.critical ? '#e76f51' : '#2a9d8f',
                    }}
                  />
                  <Typography variant="body2" fontWeight={600} color={notif.critical ? 'error.main' : 'text.primary'}>
                    {notif.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                    {notif.time}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 2 }}>
                  {notif.detail}
                </Typography>
              </MenuItem>
            ))}
          </Menu>

          {/* User Profile Icon Button */}
          <Tooltip title="Account & Settings">
            <IconButton
              color="inherit"
              aria-label="user account menu"
              onClick={(e) => setProfileAnchor(e.currentTarget)}
              sx={{
                p: 0.75,
                color: isDarkMode ? theme.palette.text.primary : '#ffffff',
                '&:hover': {
                  bgcolor: isDarkMode
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.15)',
                },
              }}
            >
              <AccountCircleIcon sx={{ fontSize: 32 }} />
            </IconButton>
          </Tooltip>

          {/* User Profile Dropdown Menu */}
          <Menu
            anchorEl={profileAnchor}
            open={isProfileOpen}
            onClose={() => setProfileAnchor(null)}
            onClick={() => setProfileAnchor(null)}
            PaperProps={{
              elevation: 4,
              sx: {
                width: 240,
                mt: 1.5,
                borderRadius: 2,
                filter: 'drop-shadow(0px 4px 16px rgba(0,0,0,0.18))',
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Section Controller
              </Typography>
              <Typography variant="caption" color="text.secondary">
                controller.pryj@indianrail.gov.in
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => setProfileAnchor(null)}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="User Profile" />
            </MenuItem>
            <MenuItem onClick={() => setProfileAnchor(null)}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Settings & Rules" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => setProfileAnchor(null)}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText primary="Sign Out" primaryTypographyProps={{ color: 'error' }} />
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
