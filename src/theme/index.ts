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
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
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
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 20,
          padding: '8px 24px',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:active': {
            transform: 'scale(0.97)'
          }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #a8c7fa 0%, #7cacf8 100%)',
          color: '#0f0f0f',
          '&:hover': {
            background: 'linear-gradient(135deg, #bbd5fb 0%, #95bbf9 100%)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
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
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateX(4px)'
          },
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
            transition: 'all 0.2s ease',
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
          borderRadius: 16,
          backgroundImage: 'none',
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(26, 26, 26, 0.85)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
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
    h4: { fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 500 },
    body2: { color: '#5f6368', fontSize: '0.9rem' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { 
          textTransform: 'none', 
          fontWeight: 500, 
          borderRadius: 20, 
          padding: '8px 24px',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:active': { transform: 'scale(0.97)' }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #0b57d0 0%, #1a73e8 100%)',
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(26, 115, 232, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
            boxShadow: '0 6px 20px rgba(26, 115, 232, 0.4)',
            transform: 'translateY(-1px)'
          },
        },
      },
    },
    MuiPaper: { 
      styleOverrides: { 
        root: { 
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        } 
      } 
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500, fontSize: '0.75rem' } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, margin: '2px 8px',
          transition: 'all 0.2s ease',
          '&:hover': { transform: 'translateX(4px)' },
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
            transition: 'all 0.2s ease',
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
          borderRadius: 16, 
          backgroundImage: 'none',
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.15)'
        } 
      } 
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 10 } } },
  },
})
