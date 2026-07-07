import React from 'react'
import {
  Box,
  IconButton,
} from '@mui/material'
import MinimizeIcon from '@mui/icons-material/Remove'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import CloseIcon from '@mui/icons-material/Close'

export default function TitleBar() {
  return (
    <Box
      className="drag-region"
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 54,
        px: 1.6,
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Box sx={{ flex: 1 }} />

      <Box className="no-drag" sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
        <IconButton
          size="small"
          onClick={() => window.electronAPI.minimize()}
          sx={{ color: 'text.secondary', borderRadius: 1.25, width: 32, height: 32, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <MinimizeIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => window.electronAPI.maximize()}
          sx={{ color: 'text.secondary', borderRadius: 1.25, width: 32, height: 32, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <CropSquareIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => window.electronAPI.close()}
          sx={{ color: 'error.main', borderRadius: 1.25, width: 32, height: 32, '&:hover': { bgcolor: 'error.main', color: (theme) => theme.palette.mode === 'dark' ? '#690005' : '#ffffff' } }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  )
}
