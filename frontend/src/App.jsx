import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';

// Import Navigation Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Import All Page Components
import Home from './pages/Home';
import Assets from './pages/Assets';
import Defects from './pages/Defects';
import Tasks from './pages/Tasks';
import Blocks from './pages/Blocks';
import Optimization from './pages/Optimization';

// Import global styles
import './App.css';

// Material-UI Dark Theme Configuration for Indian Railways Corridor Dashboard
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4ea8de', // Electric rail blue
      light: '#72bdf0',
      dark: '#2b6cb0',
      contrastText: '#0b1329',
    },
    secondary: {
      main: '#f4a261', // Safety lantern amber
      light: '#f7b884',
      dark: '#d97d34',
      contrastText: '#0b1329',
    },
    background: {
      default: '#0b1329', // Deep navy control room background
      paper: '#131e3a',   // Elevated card & drawer surface
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    success: {
      main: '#2a9d8f',
      light: '#48b5a8',
      dark: '#1e6f65',
    },
    error: {
      main: '#e76f51',
      light: '#ed8c74',
      dark: '#be4e34',
    },
    warning: {
      main: '#e9c46a',
      light: '#f0d38e',
      dark: '#c59d38',
    },
    info: {
      main: '#64dfdf',
    },
  },
  typography: {
    fontFamily: '"Inter", "Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Outfit", sans-serif', fontWeight: 700 },
    h2: { fontFamily: '"Outfit", sans-serif', fontWeight: 700 },
    h3: { fontFamily: '"Outfit", sans-serif', fontWeight: 600 },
    h4: { fontFamily: '"Outfit", sans-serif', fontWeight: 600 },
    h5: { fontFamily: '"Outfit", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Outfit", sans-serif', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#131e3a',
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.35)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 18px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});

/**
 * Main Application Component
 *
 * Requirements:
 * - Import BrowserRouter, Routes, Route from react-router-dom
 * - Import Navbar and Sidebar components
 * - Import all page components (Home, Assets, Defects, Tasks, Blocks, Optimization)
 * - Create layout with:
 *   * Navbar at top (fixed)
 *   * Sidebar on left (fixed)
 *   * Main content area (with padding for navbar and sidebar)
 * - Setup routes:
 *   * "/" → Home
 *   * "/assets" → Assets
 *   * "/defects" → Defects
 *   * "/tasks" → Tasks
 *   * "/blocks" → Blocks
 *   * "/optimization" → Optimization
 * - Use Material-UI ThemeProvider with dark theme
 * - Make responsive
 */
export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
          {/* Fixed Navbar at Top (Height: 64px) */}
          <Navbar toggleSidebar={handleDrawerToggle} />

          {/* Fixed Sidebar on Left (Width: 240px on md+, collapsible on mobile) */}
          <Sidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} />

          {/* Main Content Area with padding for navbar */}
          <Box
            component="main"
            className="main-content"
            sx={{
              flexGrow: 1,
              minHeight: '100vh',
              pt: '64px', // Top padding for 64px fixed navbar
              minWidth: 0, // Prevents flex child overflow
              display: 'flex',
              flexDirection: 'column',
              width: { xs: '100%', md: 'calc(100% - 240px)' },
              boxSizing: 'border-box',
            }}
          >
            <Box
              className="page-content"
              sx={{
                flexGrow: 1,
                p: { xs: 2, sm: 3, md: 3.5 },
                width: '100%',
                maxWidth: '1600px',
                mx: 'auto',
                boxSizing: 'border-box',
              }}
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/defects" element={<Defects />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/blocks" element={<Blocks />} />
                <Route path="/optimization" element={<Optimization />} />
              </Routes>
            </Box>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}
