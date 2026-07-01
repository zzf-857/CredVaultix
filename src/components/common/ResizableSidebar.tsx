import React, { useEffect, useState } from 'react'
import { Box, IconButton, Tooltip } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

export default function ResizableSidebar({
  width,
  collapsed,
  minWidth = 180,
  maxWidth = 420,
  collapseThreshold = 120,
  onWidthChange,
  onCollapsedChange,
  children,
}: {
  width: number
  collapsed: boolean
  minWidth?: number
  maxWidth?: number
  collapseThreshold?: number
  onWidthChange: (width: number) => void
  onCollapsedChange: (collapsed: boolean) => void
  children: React.ReactNode
}) {
  const [dragging, setDragging] = useState(false)
  const [draftWidth, setDraftWidth] = useState(width)

  useEffect(() => {
    if (!dragging) {
      setDraftWidth(width)
    }
  }, [dragging, width])

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault()
    setDragging(true)
    const startX = event.clientX
    const startWidth = width
    let latestWidth = width

    const move = (moveEvent: MouseEvent) => {
      latestWidth = Math.max(40, Math.min(maxWidth, startWidth + (moveEvent.clientX - startX)))
      setDraftWidth(latestWidth)
    }

    const stop = () => {
      setDragging(false)
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)

      if (latestWidth < collapseThreshold) {
        onCollapsedChange(true)
        return
      }

      const finalWidth = Math.max(minWidth, Math.min(maxWidth, latestWidth))
      onCollapsedChange(false)
      onWidthChange(finalWidth)
    }

    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  const renderedWidth = collapsed ? 56 : draftWidth

  return (
    <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
      <Box
        sx={{
          width: renderedWidth,
          minWidth: renderedWidth,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          transition: dragging ? 'none' : 'width 0.18s ease, min-width 0.18s ease',
        }}
      >
        {children}
      </Box>
      <Tooltip title={collapsed ? '展开侧边栏' : '折叠侧边栏'}>
        <IconButton
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          size="small"
          onClick={() => onCollapsedChange(!collapsed)}
          sx={{
            position: 'absolute',
            right: -15,
            top: 12,
            zIndex: 20,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      {!collapsed && (
        <Box
          onMouseDown={startResize}
          sx={{
            width: 6,
            cursor: 'col-resize',
            position: 'absolute',
            right: -3,
            top: 0,
            bottom: 0,
            zIndex: 10,
            bgcolor: dragging ? 'primary.main' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        />
      )}
    </Box>
  )
}
