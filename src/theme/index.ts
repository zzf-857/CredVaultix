import { createTheme } from '@mui/material/styles'

const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif"

const typography = {
  fontFamily,
  fontSize: 14,
  h4: { fontWeight: 700, letterSpacing: 0, lineHeight: 1.2 },
  h5: { fontWeight: 700, letterSpacing: 0, lineHeight: 1.25 },
  h6: { fontWeight: 700, letterSpacing: 0, lineHeight: 1.32 },
  subtitle1: { fontWeight: 600, letterSpacing: 0, lineHeight: 1.38 },
  subtitle2: { fontWeight: 700, letterSpacing: 0, lineHeight: 1.38 },
  body1: { letterSpacing: 0, lineHeight: 1.55 },
  body2: { fontSize: '0.875rem', letterSpacing: 0, lineHeight: 1.52 },
  caption: { fontSize: '0.75rem', letterSpacing: 0, lineHeight: 1.42 },
  overline: { fontSize: '0.68rem', fontWeight: 800, letterSpacing: 0, lineHeight: 1.4, textTransform: 'none' as const },
}

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#adc6ff',
      dark: '#86a8ef',
      light: '#d8e2ff',
    },
    secondary: {
      main: '#b7c8e1',
      dark: '#8fa6c0',
      light: '#d3e4fe',
    },
    background: {
      default: '#131313',
      paper: '#1c1b1b',
    },
    text: {
      primary: '#e5e2e1',
      secondary: '#c2c6d6',
    },
    divider: '#424754',
    action: {
      hover: 'rgba(173, 198, 255, 0.09)',
      selected: '#3a4a5f',
      disabled: 'rgba(229, 226, 225, 0.32)',
      disabledBackground: 'rgba(229, 226, 225, 0.08)',
    },
    error: {
      main: '#ffb4ab',
      dark: '#ff897d',
    },
    success: {
      main: '#8ddc9f',
      dark: '#61c77e',
    },
    warning: {
      main: '#ffb786',
    },
  },
  typography,
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#131313',
          color: '#e5e2e1',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 10,
          minHeight: 34,
          padding: '7px 16px',
          boxShadow: 'none',
          letterSpacing: 0,
          lineHeight: 1.35,
          transition: 'background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.12s ease',
          '&:active': {
            transform: 'scale(0.97)'
          }
        },
        sizeSmall: {
          minHeight: 34,
          padding: '6px 13px',
        },
        containedPrimary: {
          background: '#adc6ff',
          color: '#001a42',
          boxShadow: 'none',
          '&:hover': {
            background: '#d8e2ff',
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: '#424754',
          color: '#e5e2e1',
          '&:hover': {
            borderColor: '#8c909f',
            backgroundColor: 'rgba(173, 198, 255, 0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: 'none',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 700,
          fontSize: '0.72rem',
          height: 26,
          letterSpacing: 0,
          lineHeight: 1.35,
          '& .MuiChip-label': {
            paddingLeft: 9,
            paddingRight: 9,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          padding: '9px 12px',
          border: '1px solid transparent',
          transition: 'background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease',
          '&.Mui-selected': {
            backgroundColor: '#3a4a5f',
            borderColor: 'rgba(173, 198, 255, 0.22)',
            '&:hover': {
              backgroundColor: '#43556c',
            },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#201f1f',
          transition: 'background-color 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#424754',
          },
          '&:hover': {
            backgroundColor: '#2a2a2a',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#8c909f',
            },
          },
          '&.Mui-focused': {
            backgroundColor: '#201f1f',
            boxShadow: '0 0 0 1px #adc6ff',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#adc6ff',
              borderWidth: 1,
            },
          },
        },
        input: {
          padding: '11px 13px',
          lineHeight: 1.45,
        },
        inputSizeSmall: {
          padding: '9px 12px',
        },
        multiline: {
          padding: '9px 12px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            color: '#c2c6d6',
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1.35,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          fontWeight: 600,
          lineHeight: 1.45,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 38,
          paddingTop: 8,
          paddingBottom: 8,
          lineHeight: 1.4,
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 0,
          marginRight: 0,
          marginTop: 6,
          lineHeight: 1.45,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          backgroundImage: 'none',
          backgroundColor: '#1c1b1b',
          border: '1px solid #424754',
          boxShadow: '0 24px 72px rgba(0, 0, 0, 0.45)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: 1.35,
          padding: '18px 24px 15px',
          borderBottom: '1px solid #424754',
          backgroundColor: '#201f1f',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '28px 24px 20px',
          lineHeight: 1.5,
          '.MuiDialogTitle-root + &': {
            paddingTop: 28,
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          gap: 8,
          padding: '16px 24px 20px',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#201f1f',
          border: '1px solid #424754',
          borderRadius: 12,
          boxShadow: '0 18px 48px rgba(0, 0, 0, 0.35)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background-color 0.18s ease, color 0.18s ease, transform 0.12s ease',
          '&:active': {
            transform: 'scale(0.94)',
          },
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
      default: '#f6f8fc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f1f1f',
      secondary: '#5f6368',
    },
    divider: '#d7dce8',
    action: {
      hover: 'rgba(11, 87, 208, 0.06)',
      selected: '#d8e2ff',
    },
  },
  typography,
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f6f8fc',
          color: '#1f1f1f',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { 
          textTransform: 'none', 
          fontWeight: 700, 
          borderRadius: 10, 
          minHeight: 34,
          padding: '7px 16px',
          boxShadow: 'none',
          letterSpacing: 0,
          lineHeight: 1.35,
          transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease',
          '&:active': { transform: 'scale(0.97)' }
        },
        sizeSmall: {
          minHeight: 34,
          padding: '6px 13px',
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
        outlined: {
          borderColor: '#d7dce8',
          color: '#1f1f1f',
          '&:hover': {
            borderColor: '#8a91a3',
            backgroundColor: 'rgba(11, 87, 208, 0.05)',
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
    MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 700, fontSize: '0.72rem', height: 26, letterSpacing: 0, lineHeight: 1.35, '& .MuiChip-label': { paddingLeft: 9, paddingRight: 9 } } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          padding: '9px 12px',
          border: '1px solid transparent',
          transition: 'background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease',
          '&.Mui-selected': {
            backgroundColor: '#d8e2ff',
            borderColor: '#a8c7fa',
            '&:hover': { backgroundColor: '#c8d8fb' },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#ffffff',
          transition: 'background-color 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#d7dce8',
          },
          '&:hover': {
            backgroundColor: '#f8fafd',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#8a91a3',
            },
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 1px #0b57d0',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#0b57d0',
              borderWidth: 1,
            },
          },
        },
        input: {
          padding: '11px 13px',
          lineHeight: 1.45,
        },
        inputSizeSmall: {
          padding: '9px 12px',
        },
        multiline: {
          padding: '9px 12px',
        },
      },
    },
    MuiTextField: { styleOverrides: { root: { '& .MuiInputLabel-root': { fontWeight: 700, letterSpacing: 0, lineHeight: 1.35 } } } },
    MuiSelect: { styleOverrides: { select: { fontWeight: 600, lineHeight: 1.45 } } },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 38, paddingTop: 8, paddingBottom: 8, lineHeight: 1.4 } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, marginRight: 0, marginTop: 6, lineHeight: 1.45 } } },
    MuiDialog: { 
      styleOverrides: { 
        paper: { 
          borderRadius: 14, 
          backgroundImage: 'none',
          backgroundColor: '#ffffff',
          border: '1px solid #d7dce8',
          boxShadow: '0 20px 48px rgba(31, 31, 31, 0.14)'
        } 
      } 
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: 1.35,
          padding: '18px 24px 15px',
          borderBottom: '1px solid #d7dce8',
          backgroundColor: '#f8fafd',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '28px 24px 20px',
          lineHeight: 1.5,
          '.MuiDialogTitle-root + &': {
            paddingTop: 28,
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          gap: 8,
          padding: '16px 24px 20px',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: '1px solid #d7dce8',
          borderRadius: 12,
          boxShadow: '0 18px 48px rgba(31, 31, 31, 0.12)',
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 10, '&:active': { transform: 'scale(0.94)' } } } },
  },
})
