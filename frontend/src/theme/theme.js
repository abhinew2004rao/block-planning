import { createTheme } from '@mui/material/styles';

/**
 * Common Typography configuration for H1-H6 sizes and Roboto font family.
 */
const typography = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01562em',
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.00833em',
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '0em',
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '0.00735em',
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0em',
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: '0.0075em',
  },
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.57,
  },
  body1: {
    fontSize: '0.9375rem',
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.43,
  },
  button: {
    textTransform: 'none',
    fontWeight: 600,
  },
};

/**
 * Component overrides for Buttons (rounded corners), Cards (shadow), and DataGrid (borderless).
 *
 * @param {'light' | 'dark'} mode
 */
const getComponentOverrides = (mode = 'light') => ({
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8, // Rounded corners
        textTransform: 'none',
        fontWeight: 600,
        padding: '8px 18px',
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        backgroundImage: 'none',
        boxShadow:
          mode === 'dark'
            ? '0 4px 20px rgba(0, 0, 0, 0.45)'
            : '0 4px 20px rgba(0, 0, 0, 0.08)', // Card shadow
      },
    },
  },
  MuiDataGrid: {
    styleOverrides: {
      root: {
        border: 'none', // Borderless DataGrid
        '& .MuiDataGrid-cell': {
          borderBottom: 'none', // Borderless cells
        },
        '& .MuiDataGrid-columnHeaders': {
          borderBottom: 'none', // Borderless header
        },
        '& .MuiDataGrid-footerContainer': {
          borderTop: 'none', // Borderless footer
        },
        '& .MuiDataGrid-columnSeparator': {
          display: 'none', // Remove vertical column split line
        },
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
});

/**
 * Light Theme
 *
 * Requirements:
 * - Color palette:
 *   * Primary: #1976d2 (blue)
 *   * Secondary: #dc004e (red)
 *   * Background: #f5f5f5 (light gray)
 *   * Paper: #ffffff (white)
 *   * Text: #333333 (dark gray)
 * - Typography:
 *   * Font family: Roboto
 *   * H1-H6 sizes
 * - Component overrides:
 *   * MuiButton (rounded corners)
 *   * MuiCard (shadow)
 *   * MuiDataGrid (borderless)
 */
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff4081',
      dark: '#9a0036',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
  },
  shape: {
    borderRadius: 8,
  },
  typography,
  components: getComponentOverrides('light'),
});

/**
 * Dark Theme Option
 *
 * Provides equivalent dark mode palette with the same Roboto typography,
 * rounded buttons, elevated shadows, and borderless DataGrid components.
 */
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: '#0a1929',
    },
    secondary: {
      main: '#f48fb1',
      light: '#f8bbd0',
      dark: '#c2185b',
      contrastText: '#0a1929',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0bec5',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  shape: {
    borderRadius: 8,
  },
  typography,
  components: getComponentOverrides('dark'),
});

/**
 * Dynamic theme factory allowing switching between light and dark modes.
 *
 * @param {'light' | 'dark'} mode
 * @returns {import('@mui/material').Theme}
 */
export const getTheme = (mode = 'light') => (mode === 'dark' ? darkTheme : lightTheme);

// Default and named exports
export const theme = lightTheme;
export default lightTheme;
