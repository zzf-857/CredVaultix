import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import MinimizeIcon from '@mui/icons-material/Remove'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import CloseIcon from '@mui/icons-material/Close'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import DownloadIcon from '@mui/icons-material/Download'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SearchIcon from '@mui/icons-material/Search'
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'
import { useStore } from '../stores/useStore'
import type { UpdateMessage } from '../types'

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'latest'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'portable'

function getFriendlyUpdateError(error?: string) {
  const message = String(error || '').toLowerCase()
  if (message.includes('404') || message.includes('not found') || message.includes('latest.yml')) {
    return '未检测到线上的正式发布版本'
  }
  if (message.includes('开发环境')) {
    return error || '开发环境跳过更新检查'
  }
  return error || '检查更新失败，请稍后再试'
}

export default function TitleBar() {
  const { themeMode, toggleTheme, exportDatabase, importDatabase } = useStore()
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateStatusText, setUpdateStatusText] = useState('点击检查更新以获取 GitHub 最新版本')
  const [downloadPercent, setDownloadPercent] = useState(0)

  useEffect(() => {
    window.electronAPI.getVersion().then(setAppVersion).catch(() => {
      setAppVersion('')
    })

    const unsubscribe = window.electronAPI.onUpdateMessage((data: UpdateMessage) => {
      const { status, version, percent, error, isPortable } = data

      if (isPortable || status === 'portable') {
        setUpdateStatus('portable')
        setUpdateStatusText('当前为便携版，请前往 GitHub 手动下载最新版')
        return
      }

      setUpdateStatus(status)
      switch (status) {
        case 'checking':
          setUpdateStatusText('正在检查更新...')
          break
        case 'available':
          setUpdateStatusText(`发现新版本 v${version}，可手动下载更新包`)
          setDownloadPercent(0)
          break
        case 'latest':
          setUpdateStatusText('当前已是最新版本')
          break
        case 'downloading':
          setUpdateStatusText('正在下载更新包...')
          setDownloadPercent(Math.round(percent || 0))
          break
        case 'downloaded':
          setUpdateStatusText(`新版本 v${version} 已下载完成`)
          setDownloadPercent(100)
          break
        case 'error':
          setUpdateStatusText(getFriendlyUpdateError(error))
          break
        default:
          break
      }
    })

    return unsubscribe
  }, [])

  const handleCheckUpdates = async () => {
    setUpdateStatus('checking')
    setUpdateStatusText('正在连接 GitHub 检查更新...')
    setDownloadPercent(0)

    const result = await window.electronAPI.checkUpdates()
    if (result.isPortable || result.status === 'portable') {
      setUpdateStatus('portable')
      setUpdateStatusText('当前为便携版，请前往 GitHub 手动下载最新版')
      return
    }
    if (!result.success) {
      setUpdateStatus('error')
      setUpdateStatusText(getFriendlyUpdateError(result.error))
    }
  }

  const handleDownloadUpdate = async () => {
    setUpdateStatus('downloading')
    setUpdateStatusText('正在下载更新包...')
    setDownloadPercent(0)

    const result = await window.electronAPI.downloadUpdate()
    if (result.isPortable || result.status === 'portable') {
      setUpdateStatus('portable')
      setUpdateStatusText('当前为便携版，请前往 GitHub 手动下载最新版')
      return
    }
    if (!result.success) {
      setUpdateStatus('error')
      setUpdateStatusText(getFriendlyUpdateError(result.error || '下载更新失败，请稍后再试'))
    }
  }

  const handleQuitAndInstall = () => {
    window.electronAPI.quitAndInstall()
  }

  const busy = updateStatus === 'checking' || updateStatus === 'downloading'

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
        <Tooltip title="版本与更新">
          <IconButton
            size="small"
            onClick={() => setUpdateDialogOpen(true)}
            color={updateStatus === 'available' || updateStatus === 'downloaded' ? 'primary' : 'default'}
            sx={{ color: updateStatus === 'available' || updateStatus === 'downloaded' ? 'primary.main' : 'text.secondary', width: 32, height: 32, '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
          >
            <SystemUpdateAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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

      <Dialog
        open={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>版本与更新</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.25}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                当前版本
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                v{appVersion || '-'}
              </Typography>
            </Box>

            <Alert severity="info" variant="outlined">
              升级不会删除本地数据库，建议定期导出备份。
            </Alert>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {updateStatusText}
              </Typography>
              {updateStatus === 'downloading' && (
                <Box sx={{ mt: 1.25 }}>
                  <LinearProgress variant="determinate" value={downloadPercent} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {downloadPercent}%
                  </Typography>
                </Box>
              )}
            </Box>

            {updateStatus === 'error' && (
              <Alert severity="warning" variant="outlined">
                {updateStatusText}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setUpdateDialogOpen(false)} color="inherit">
            关闭
          </Button>
          <Button
            onClick={handleCheckUpdates}
            disabled={busy}
            startIcon={<SearchIcon />}
            variant="outlined"
          >
            检查更新
          </Button>
          {updateStatus === 'available' && (
            <Button
              onClick={handleDownloadUpdate}
              disabled={busy}
              startIcon={<DownloadIcon />}
              variant="contained"
            >
              下载更新包
            </Button>
          )}
          {updateStatus === 'downloaded' && (
            <Button
              onClick={handleQuitAndInstall}
              startIcon={<RestartAltIcon />}
              color="success"
              variant="contained"
            >
              重启安装
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
