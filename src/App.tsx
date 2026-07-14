import React, { lazy, Suspense, useEffect, useState } from 'react'
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material'
import { darkTheme, lightTheme } from './theme'
import { useStore } from './stores/useStore'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import ResizableSidebar from './components/common/ResizableSidebar'

const AccountsView = lazy(() => import('./components/AccountsView'))
const ServiceInfoManager = lazy(() => import('./components/service-info/ServiceInfoManager'))
const TwoFactorPanel = lazy(() => import('./components/TwoFactorPanel'))
const TrashManager = lazy(() => import('./components/TrashManager'))

export default function App() {
  const themeMode = useStore((s) => s.themeMode)
  const activeView = useStore((s) => s.activeView)
  const loadAppPreferences = useStore((s) => s.loadAppPreferences)

  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    let mounted = true

    void loadAppPreferences().then((preferences) => {
      if (!mounted) return
      const savedWidth = typeof preferences.sidebarWidth === 'number' ? preferences.sidebarWidth : 240
      const normalizedWidth = Math.max(200, Math.min(420, savedWidth))
      setSidebarWidth(normalizedWidth)
      if (normalizedWidth !== savedWidth) {
        void window.electronAPI.updateAppPreferences({ sidebarWidth: normalizedWidth })
      }
      setSidebarCollapsed(preferences.sidebarCollapsed === true)
    }).catch((error) => {
      console.error('Failed to load shared app preferences:', error)
    })

    return () => {
      mounted = false
    }
  }, [loadAppPreferences])

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
            <Suspense
              fallback={(
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
                  <CircularProgress size={28} />
                </Box>
              )}
            >
              {activeView === 'accounts' && <AccountsView />}
              {activeView === 'service-info' && <ServiceInfoManager />}
              {activeView === '2fa' && <TwoFactorPanel />}
              {activeView === 'trash' && <TrashManager />}
            </Suspense>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
