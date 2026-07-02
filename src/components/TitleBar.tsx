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
        height: 48,
        px: 1.25,
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#0e0e0e' : '#ffffff',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.main',
          color: (theme) => theme.palette.mode === 'dark' ? '#001a42' : '#ffffff',
          fontWeight: 900,
          ml: 0.5,
          mr: 1,
        }}
      >
        C
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 800,
            letterSpacing: 0,
            fontSize: '0.95rem',
            lineHeight: 1.1,
            color: 'text.primary',
          }}
        >
          CredVaultix
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.68rem',
            lineHeight: 1,
          }}
        >
          本地账号与服务信息库
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box className="no-drag" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <IconButton
          size="small"
          onClick={importDatabase}
          title="导入数据库"
          sx={{ color: 'text.secondary', width: 32, height: 32, '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
        >
          <FileUploadIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={exportDatabase}
          title="导出数据库"
          sx={{ color: 'text.secondary', width: 32, height: 32, '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
        >
          <FileDownloadIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={toggleTheme}
          title="切换主题"
          sx={{ color: 'text.secondary', width: 32, height: 32, '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
        >
          {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>

        <Box sx={{ width: 8 }} />

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
