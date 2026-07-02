import React, { useEffect, useState } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { darkTheme, lightTheme } from './theme'
import { useStore } from './stores/useStore'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import TwoFactorPanel from './components/TwoFactorPanel'
import AccountManager from './components/AccountManager'
import TrashManager from './components/TrashManager'
import ServiceInfoManager from './components/service-info/ServiceInfoManager'
import ResizableSidebar from './components/common/ResizableSidebar'

export default function App() {
  const themeMode = useStore((s) => s.themeMode)
  const activeView = useStore((s) => s.activeView)

  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    let mounted = true

    window.electronAPI.getAppPreferences().then((preferences) => {
      if (!mounted) return
      const savedWidth = typeof preferences.sidebarWidth === 'number' ? preferences.sidebarWidth : 240
      setSidebarWidth(Math.max(200, Math.min(420, savedWidth)))
      setSidebarCollapsed(preferences.sidebarCollapsed === true)
    }).catch((error) => {
      console.error('Failed to load app preferences:', error)
    })

    return () => {
      mounted = false
    }
  }, [])

  const persistSidebarWidth = (width: number) => {
    setSidebarWidth(width)
    void window.electronAPI.updateAppPreferences({ sidebarWidth: width })
  }

  const persistSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    void window.electronAPI.updateAppPreferences({ sidebarCollapsed: collapsed })
  }

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
          <ResizableSidebar
            width={sidebarWidth}
            collapsed={sidebarCollapsed}
            onWidthChange={persistSidebarWidth}
            onCollapsedChange={persistSidebarCollapsed}
          >
            <Sidebar collapsed={sidebarCollapsed} />
          </ResizableSidebar>
          <Box 
            key={activeView} 
            className="fade-in-up" 
            sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}
          >
            {activeView === 'accounts' && <AccountManager />}
            {activeView === 'service-info' && <ServiceInfoManager />}
            {activeView === '2fa' && <TwoFactorPanel />}
            {activeView === 'trash' && <TrashManager />}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
