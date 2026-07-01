import React, { useState } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { darkTheme, lightTheme } from './theme'
import { useStore } from './stores/useStore'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import TwoFactorPanel from './components/TwoFactorPanel'
import AccountManager from './components/AccountManager'
import TrashManager from './components/TrashManager'
import ServiceInfoManager from './components/service-info/ServiceInfoManager'

export default function App() {
  const themeMode = useStore((s) => s.themeMode)
  const activeView = useStore((s) => s.activeView)

  // Sidebar custom width states
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('app_sidebar_width')
      return saved ? parseInt(saved, 10) : 260
    } catch {
      return 260
    }
  })

  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const doDrag = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(400, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(newWidth)
      try {
        localStorage.setItem('app_sidebar_width', newWidth.toString())
      } catch {}
    }

    const stopDrag = () => {
      window.removeEventListener('mousemove', doDrag)
      window.removeEventListener('mouseup', stopDrag)
    }

    window.addEventListener('mousemove', doDrag)
    window.addEventListener('mouseup', stopDrag)
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
          <Sidebar width={sidebarWidth} />
          {/* 侧边栏垂直拖动分割条 */}
          <Box
            onMouseDown={handleSidebarResizeStart}
            sx={{
              width: '4px',
              cursor: 'col-resize',
              bgcolor: 'divider',
              transition: 'background-color 0.2s',
              position: 'relative',
              zIndex: 10,
              '&:hover': {
                bgcolor: 'primary.main',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-4px',
                right: '-4px',
                bottom: 0,
              }
            }}
          />
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
