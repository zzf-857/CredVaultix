import { alpha, createTheme } from '@mui/material/styles'

type PaletteMode = 'light' | 'dark'

declare module '@mui/material/styles' {
  interface Palette {
    surface: {
      sunken: string
      raised: string
      elevated: string
    }
    border: {
      subtle: string
      strong: string
    }
  }

  interface PaletteOptions {
    surface?: {
      sunken: string
      raised: string
      elevated: string
    }
    border?: {
      subtle: string
      strong: string
    }
  }
}

const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif"

const typography = {
  fontFamily,
  fontSize: 14,
  h4: { fontWeight: 600, letterSpacing: 0, lineHeight: 1.2 },
  h5: { fontWeight: 600, letterSpacing: 0, lineHeight: 1.24 },
  h6: { fontWeight: 600, letterSpacing: 0, lineHeight: 1.3 },
  subtitle1: { fontWeight: 600, letterSpacing: 0, lineHeight: 1.38 },
  subtitle2: { fontWeight: 600, letterSpacing: 0, lineHeight: 1.38 },
  body1: { letterSpacing: 0, lineHeight: 1.52 },
  body2: { fontSize: '0.875rem', letterSpacing: 0, lineHeight: 1.5 },
  caption: { fontSize: '0.75rem', letterSpacing: 0, lineHeight: 1.4 },
  overline: {
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: 1.4,
    textTransform: 'none' as const,
  },
}

const colorTokens = {
  dark: {
    canvas: '#111315',
    surface: '#181a1d',
    sunken: '#0d0f11',
    raised: '#202328',
    elevated: '#272a30',
    divider: '#30343b',
    borderStrong: '#454b55',
    text: '#edf0f4',
    textSecondary: '#aab0ba',
    primary: '#9db8ff',
    primaryDark: '#7899ec',
    primaryLight: '#cbd8ff',
  },
  light: {
    canvas: '#f3f5f8',
    surface: '#ffffff',
    sunken: '#e9edf2',
    raised: '#f7f8fa',
    elevated: '#ffffff',
    divider: '#dce1e8',
    borderStrong: '#b8c0cc',
    text: '#20242a',
    textSecondary: '#606873',
    primary: '#2459c4',
    primaryDark: '#174394',
    primaryLight: '#dbe5ff',
  },
} as const

function buildTheme(mode: PaletteMode) {
  const colors = colorTokens[mode]
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        dark: colors.primaryDark,
        light: colors.primaryLight,
        contrastText: isDark ? '#0b2148' : '#ffffff',
      },
      secondary: {
        main: isDark ? '#8fc9bd' : '#2b7167',
        dark: isDark ? '#69a69a' : '#20584f',
        light: isDark ? '#b8e4dc' : '#d2efea',
      },
      background: {
        default: colors.canvas,
        paper: colors.surface,
      },
      text: {
        primary: colors.text,
        secondary: colors.textSecondary,
      },
      divider: colors.divider,
      surface: {
        sunken: colors.sunken,
        raised: colors.raised,
        elevated: colors.elevated,
      },
      border: {
        subtle: colors.divider,
        strong: colors.borderStrong,
      },
      action: {
        hover: alpha(colors.primary, isDark ? 0.09 : 0.065),
        selected: alpha(colors.primary, isDark ? 0.14 : 0.11),
        focus: alpha(colors.primary, 0.2),
        disabled: alpha(colors.text, 0.34),
        disabledBackground: alpha(colors.text, 0.08),
      },
      error: {
        main: isDark ? '#ff9d94' : '#ba3a33',
        dark: isDark ? '#ff7b70' : '#8f2924',
      },
      success: {
        main: isDark ? '#7fd39a' : '#287a45',
        dark: isDark ? '#5bbd79' : '#1e6035',
      },
      warning: {
        main: isDark ? '#f0b06a' : '#9a5900',
        dark: isDark ? '#d8944c' : '#754300',
      },
    },
    typography,
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.canvas,
            color: colors.text,
          },
          '*:focus-visible': {
            outline: `2px solid ${colors.primary}`,
            outlineOffset: 2,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 34,
            padding: '6px 13px',
            borderRadius: 7,
            boxShadow: 'none',
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1.35,
            textTransform: 'none',
            transition: 'background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease',
          },
          sizeSmall: {
            minHeight: 30,
            padding: '4px 10px',
          },
          containedPrimary: {
            backgroundColor: colors.primary,
            color: isDark ? '#0b2148' : '#ffffff',
            '&:hover': {
              backgroundColor: isDark ? colors.primaryLight : colors.primaryDark,
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: colors.divider,
            color: colors.text,
            '&:hover': {
              borderColor: colors.borderStrong,
              backgroundColor: alpha(colors.primary, isDark ? 0.08 : 0.05),
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 7,
            transition: 'background-color 0.16s ease, color 0.16s ease',
          },
          sizeSmall: {
            padding: 6,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
          },
          outlined: {
            borderColor: colors.divider,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            height: 24,
            borderRadius: 6,
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1.3,
            '& .MuiChip-label': {
              paddingLeft: 8,
              paddingRight: 8,
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 40,
            margin: 0,
            padding: '8px 10px',
            border: '1px solid transparent',
            borderRadius: 7,
            transition: 'background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease',
            '&.Mui-selected': {
              backgroundColor: alpha(colors.primary, isDark ? 0.13 : 0.1),
              borderColor: alpha(colors.primary, isDark ? 0.22 : 0.2),
              '&:hover': {
                backgroundColor: alpha(colors.primary, isDark ? 0.17 : 0.14),
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: colors.raised,
            transition: 'background-color 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.divider,
            },
            '&:hover': {
              backgroundColor: colors.elevated,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.borderStrong,
              },
            },
            '&.Mui-focused': {
              backgroundColor: colors.raised,
              boxShadow: `0 0 0 2px ${alpha(colors.primary, 0.24)}`,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.primary,
                borderWidth: 1,
              },
            },
          },
          input: {
            padding: '10px 12px',
            lineHeight: 1.4,
          },
          inputSizeSmall: {
            padding: '8px 10px',
          },
          multiline: {
            padding: '8px 10px',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiInputLabel-root': {
              color: colors.textSecondary,
              fontWeight: 500,
              letterSpacing: 0,
              lineHeight: 1.35,
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            fontWeight: 500,
            lineHeight: 1.4,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: 36,
            paddingTop: 7,
            paddingBottom: 7,
            lineHeight: 1.4,
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginLeft: 0,
            marginRight: 0,
            marginTop: 5,
            lineHeight: 1.4,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${colors.divider}`,
            borderRadius: 12,
            backgroundColor: colors.surface,
            backgroundImage: 'none',
            boxShadow: isDark
              ? '0 18px 56px rgba(0, 0, 0, 0.42)'
              : '0 18px 48px rgba(32, 36, 42, 0.16)',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: '17px 20px 14px',
            borderBottom: `1px solid ${colors.divider}`,
            backgroundColor: colors.surface,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1.35,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: '22px 20px 18px',
            lineHeight: 1.5,
            '.MuiDialogTitle-root + &': {
              paddingTop: 22,
            },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            gap: 6,
            padding: '12px 20px 18px',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${colors.divider}`,
            borderRadius: 9,
            backgroundColor: colors.elevated,
            boxShadow: isDark
              ? '0 14px 40px rgba(0, 0, 0, 0.38)'
              : '0 14px 34px rgba(32, 36, 42, 0.13)',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            minHeight: 32,
            borderColor: colors.divider,
            padding: '5px 10px',
            color: colors.textSecondary,
            fontWeight: 600,
            letterSpacing: 0,
            textTransform: 'none',
            '&.Mui-selected': {
              color: colors.text,
              backgroundColor: alpha(colors.primary, isDark ? 0.15 : 0.12),
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            height: 3,
            borderRadius: 3,
            backgroundColor: colors.divider,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            border: `1px solid ${colors.divider}`,
            backgroundColor: isDark ? '#2b2f35' : '#252a31',
            borderRadius: 6,
            fontSize: '0.72rem',
            fontWeight: 500,
          },
        },
      },
    },
  })
}

export const darkTheme = buildTheme('dark')
export const lightTheme = buildTheme('light')
