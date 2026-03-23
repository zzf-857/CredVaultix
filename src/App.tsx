import React from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { darkTheme, lightTheme } from './theme'
import { useStore } from './stores/useStore'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import PromptList from './components/PromptList'
import PromptDetail from './components/PromptDetail'
import TwoFactorPanel from './components/TwoFactorPanel'
import AccountManager from './components/AccountManager'
import AddressGenerator from './components/AddressGenerator'

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
          {activeView === 'accounts' && <AccountManager />}
          {activeView === 'prompts' && (
            <>
              <PromptList />
              <PromptDetail />
            </>
          )}
          {activeView === '2fa' && <TwoFactorPanel />}
          {activeView === 'address-generator' && <AddressGenerator />}
        </Box>
      </Box>
    </ThemeProvider>
  )
}
