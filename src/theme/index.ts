import { createTheme } from '@mui/material/styles'

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#a8c7fa',
      dark: '#7cacf8',
      light: '#d3e3fd',
    },
    secondary: {
      main: '#c2e7ff',
    },
    background: {
      default: '#0f0f0f',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#e3e3e3',
      secondary: '#9e9e9e',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    action: {
      hover: 'rgba(168, 199, 250, 0.08)',
      selected: 'rgba(168, 199, 250, 0.12)',
    },
    error: {
      main: '#f2b8b5',
    },
    success: {
      main: '#81c995',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif",
    fontSize: 15.2,
    h4: {
      fontWeight: 600,
      letterSpacing: 0,
    },
    h5: {
      fontWeight: 600,
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: 0,
    },
    subtitle1: {
      fontWeight: 500,
    },
    body2: {
      color: '#9e9e9e',
      fontSize: '0.9rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
          padding: '7px 16px',
          transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
          '&:active': {
            transform: 'scale(0.97)'
          }
        },
        containedPrimary: {
          background: '#a8c7fa',
          color: '#0f0f0f',
          '&:hover': {
            background: '#bbd5fb',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.22)',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          transition: 'background-color 0.18s ease',
          '&.Mui-selected': {
            backgroundColor: 'rgba(168, 199, 250, 0.12)',
            '&:hover': {
              backgroundColor: 'rgba(168, 199, 250, 0.16)',
            },
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            transition: 'background-color 0.18s ease, box-shadow 0.18s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              boxShadow: '0 4px 20px rgba(168, 199, 250, 0.15)',
            }
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          backgroundImage: 'none',
          backgroundColor: '#1a1a1a',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.36)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
  },
})

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0b57d0',
      dark: '#0842a0',
      light: '#a8c7fa',
    },
    secondary: {
      main: '#0b57d0',
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f1f1f',
      secondary: '#5f6368',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
    action: {
      hover: 'rgba(11, 87, 208, 0.06)',
      selected: 'rgba(11, 87, 208, 0.10)',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif",
    fontSize: 15.2,
    h4: { fontWeight: 600, letterSpacing: 0 },
    h5: { fontWeight: 600, letterSpacing: 0 },
    h6: { fontWeight: 600, letterSpacing: 0 },
    subtitle1: { fontWeight: 500 },
    body2: { color: '#5f6368', fontSize: '0.9rem' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { 
          textTransform: 'none', 
          fontWeight: 500, 
          borderRadius: 8, 
          padding: '7px 16px',
          transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
          '&:active': { transform: 'scale(0.97)' }
        },
        containedPrimary: {
          background: '#0b57d0',
          color: '#ffffff',
          boxShadow: 'none',
          '&:hover': {
            background: '#1a73e8',
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: { 
      styleOverrides: { 
        root: { 
          backgroundImage: 'none',
          boxShadow: '0 1px 8px rgba(0, 0, 0, 0.06)',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        } 
      } 
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500, fontSize: '0.75rem' } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, margin: '2px 8px',
          transition: 'background-color 0.18s ease',
          '&.Mui-selected': {
            backgroundColor: 'rgba(11, 87, 208, 0.10)',
            '&:hover': { backgroundColor: 'rgba(11, 87, 208, 0.14)' },
          },
        },
      },
    },
    MuiTextField: { 
      styleOverrides: { 
        root: { 
          '& .MuiOutlinedInput-root': { 
            borderRadius: 12,
            transition: 'background-color 0.18s ease, box-shadow 0.18s ease',
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.02)' },
            '&.Mui-focused': {
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              boxShadow: '0 4px 20px rgba(11, 87, 208, 0.1)'
            }
          } 
        } 
      } 
    },
    MuiDialog: { 
      styleOverrides: { 
        paper: { 
          borderRadius: 10, 
          backgroundImage: 'none',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.14)'
        } 
      } 
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 10 } } },
  },
})
