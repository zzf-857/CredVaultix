import React from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { darkTheme, lightTheme } from './theme'
import { useStore } from './stores/useStore'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import TwoFactorPanel from './components/TwoFactorPanel'
import AccountManager from './components/AccountManager'
import TrashManager from './components/TrashManager'

export default function App() {
  const themeMode = useStore((s) => s.themeMode)
  const activeView = useStore((s) => s.activeView)

  return (
    <ThemeProvider theme={themeMode === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          bgcolor: 'background.default',
          overflow: 'hidden',
        }}
      >
        <TitleBar />
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar />
          <Box 
            key={activeView} 
            className="fade-in-up" 
            sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}
          >
            {activeView === 'accounts' && <AccountManager />}
            {activeView === '2fa' && <TwoFactorPanel />}
            {activeView === 'trash' && <TrashManager />}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
