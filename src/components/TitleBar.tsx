import React from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import MinimizeIcon from '@mui/icons-material/Remove'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import CloseIcon from '@mui/icons-material/Close'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useStore } from '../stores/useStore'

export default function TitleBar() {
  const { themeMode, toggleTheme, exportDatabase, importDatabase } = useStore()

  return (
    <Box
      className="drag-region"
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        px: 1.5,
        backgroundColor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
          letterSpacing: '0.04em',
          fontSize: '0.8rem',
          color: 'text.secondary',
          ml: 1,
        }}
      >
        ACCOUNT MANAGER
      </Typography>

      <Box sx={{ flex: 1 }} />

      <Box className="no-drag" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <IconButton
          size="small"
          onClick={importDatabase}
          title="导入数据库"
          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
        >
          <FileUploadIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={exportDatabase}
          title="导出数据库"
          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
        >
          <FileDownloadIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={toggleTheme}
          title="切换主题"
          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
        >
          {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>

        <Box sx={{ width: 8 }} />

        <IconButton
          size="small"
          onClick={() => window.electronAPI.minimize()}
          sx={{ color: 'text.secondary', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <MinimizeIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => window.electronAPI.maximize()}
          sx={{ color: 'text.secondary', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <CropSquareIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => window.electronAPI.close()}
          sx={{ color: 'text.secondary', borderRadius: 1, '&:hover': { bgcolor: 'error.main', color: 'white' } }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  )
}
