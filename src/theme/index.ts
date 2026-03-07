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
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backgroundImage: 'none',
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
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h4: { fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 500 },
    body2: { color: '#5f6368' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, borderRadius: 20, padding: '8px 24px' },
        containedPrimary: {
          background: 'linear-gradient(135deg, #0b57d0 0%, #1a73e8 100%)',
          color: '#ffffff',
          '&:hover': { background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500, fontSize: '0.75rem' } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(11, 87, 208, 0.10)',
            '&:hover': { backgroundColor: 'rgba(11, 87, 208, 0.14)' },
          },
        },
      },
    },
    MuiTextField: { styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 12 } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16, backgroundImage: 'none' } } },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 10 } } },
  },
})
