import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import EngineeringIcon from '@mui/icons-material/Engineering';
import BugReportIcon from '@mui/icons-material/BugReport';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AnalyticsIcon from '@mui/icons-material/Analytics';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { label: 'Home', path: '/', icon: <HomeIcon /> },
  { label: 'Assets', path: '/assets', icon: <EngineeringIcon /> },
  { label: 'Defects', path: '/defects', icon: <BugReportIcon /> },
  { label: 'Tasks', path: '/tasks', icon: <AssignmentIcon /> },
  { label: 'Blocks', path: '/blocks', icon: <CalendarTodayIcon /> },
  { label: 'Optimization', path: '/optimization', icon: <AnalyticsIcon /> },
];

/**
 * Sidebar Component for Indian Railways Block Planning
 *
 * Requirements:
 * - Drawer on left side
 * - Width: 240px
 * - Navigation items:
 *   * Home (icon: Home)
 *   * Assets (icon: Engineering)
 *   * Defects (icon: BugReport)
 *   * Tasks (icon: Assignment)
 *   * Blocks (icon: CalendarToday)
 *   * Optimization (icon: Analytics)
 * - Active item highlighting
 * - Click to navigate using react-router-dom
 * - Collapsible on mobile
 * - Include proper imports from @mui/material and icons
 */
export default function Sidebar({ mobileOpen = false, handleDrawerToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDarkMode = theme.palette.mode === 'dark';

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile && handleDrawerToggle) {
      handleDrawerToggle();
    }
  };

  const drawerContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: isDarkMode ? theme.palette.background.paper : '#ffffff',
        color: isDarkMode ? theme.palette.text.primary : '#1d2a44',
      }}
    >
      {/* Sidebar Header Section */}
      <Box sx={{ px: 2.5, pt: 3, pb: 1.5 }}>
        <Typography
          variant="overline"
          sx={{
            fontWeight: 700,
            color: isDarkMode ? theme.palette.text.secondary : '#7b8794',
            letterSpacing: 1.2,
            fontSize: '0.72rem',
          }}
        >
          OPERATIONS CORRIDOR
        </Typography>
      </Box>

      {/* Navigation List */}
      <List sx={{ px: 1.5, py: 0.5, flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`);

          const activeColor = isDarkMode ? theme.palette.secondary.main : '#0d3b66';
          const activeBg = isDarkMode
            ? 'rgba(244, 162, 97, 0.12)'
            : 'rgba(13, 59, 102, 0.08)';
          const hoverBg = isDarkMode
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(0, 0, 0, 0.04)';

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.8 }}>
              <ListItemButton
                onClick={() => handleNavClick(item.path)}
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  py: 1.1,
                  px: 1.5,
                  backgroundColor: isActive ? `${activeBg} !important` : 'transparent',
                  color: isActive ? activeColor : 'inherit',
                  fontWeight: isActive ? 700 : 500,
                  borderLeft: isActive
                    ? `4px solid ${activeColor}`
                    : '4px solid transparent',
                  transition: 'all 0.18s ease-in-out',
                  '&:hover': {
                    backgroundColor: isActive
                      ? isDarkMode
                        ? 'rgba(244, 162, 97, 0.18)'
                        : 'rgba(13, 59, 102, 0.12)'
                      : hoverBg,
                    color: activeColor,
                    '& .MuiListItemIcon-root': {
                      color: activeColor,
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 38,
                    color: isActive
                      ? activeColor
                      : isDarkMode
                      ? theme.palette.text.secondary
                      : '#7b8794',
                    transition: 'color 0.18s ease-in-out',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.92rem',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: 0.2,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ my: 1, borderColor: isDarkMode ? theme.palette.divider : 'rgba(0,0,0,0.06)' }} />

      {/* Footer / System Meta Info */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            color: isDarkMode ? theme.palette.text.secondary : '#9aa5b1',
            fontWeight: 600,
            display: 'block',
            letterSpacing: 0.5,
          }}
        >
          IR Block Planner v1.0
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: isDarkMode ? theme.palette.text.secondary : '#9aa5b1',
            fontSize: '0.68rem',
          }}
        >
          North Central Railway • PRYJ
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{
        width: { md: DRAWER_WIDTH },
        flexShrink: { md: 0 },
      }}
      aria-label="corridor navigation menu"
    >
      {/* Mobile Temporary Collapsible Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Enhances mobile open performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            borderRight: isDarkMode
              ? `1px solid ${theme.palette.divider}`
              : '1px solid rgba(0, 0, 0, 0.08)',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Permanent Drawer */}
      <Drawer
        variant="permanent"
        anchor="left"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            borderRight: isDarkMode
              ? `1px solid ${theme.palette.divider}`
              : '1px solid rgba(0, 0, 0, 0.08)',
            position: 'fixed',
            top: '64px',
            left: 0,
            height: 'calc(100vh - 64px)',
            backgroundColor: isDarkMode ? theme.palette.background.paper : '#ffffff',
            zIndex: (th) => th.zIndex.appBar - 1,
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
