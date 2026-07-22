import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import DownloadIcon from '@mui/icons-material/Download'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LightModeIcon from '@mui/icons-material/LightMode'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
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
  | 'installing'
  | 'error'
  | 'portable'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

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

function sectionSx() {
  return {
    p: 2,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    bgcolor: (theme: any) => theme.palette.mode === 'dark' ? '#171717' : '#f8fafd',
  }
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { themeMode, toggleTheme, exportDatabase, importDatabase, navigationBlockReason } = useStore()
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateStatusText, setUpdateStatusText] = useState('点击检查更新以获取 GitHub 最新版本')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)

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
        case 'installing':
          setUpdateStatusText('正在退出并安装更新...')
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

  const handleQuitAndInstall = async () => {
    if (updateStatus === 'installing') return

    setUpdateStatus('installing')
    setUpdateStatusText('正在退出并安装更新...')

    try {
      const started = await window.electronAPI.quitAndInstall()
      if (!started) {
        setUpdateStatus('error')
        setUpdateStatusText('无法启动更新安装，请重新下载更新包')
      }
    } catch (error) {
      setUpdateStatus('error')
      setUpdateStatusText(getFriendlyUpdateError(error instanceof Error ? error.message : String(error)))
    }
  }

  const busy = updateStatus === 'checking' || updateStatus === 'downloading' || updateStatus === 'installing'

  const handleExportDatabase = async () => {
    try {
      const result = await exportDatabase()
      if (result.success) {
        setNotice({ severity: 'success', text: `备份已导出${result.filePath ? `：${result.filePath}` : ''}` })
      }
    } catch (error) {
      setNotice({ severity: 'error', text: `导出失败：${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const handleImportDatabase = async () => {
    setImportConfirmOpen(false)
    try {
      const result = await importDatabase()
      if (result.success) {
        setNotice({
          severity: result.refreshFailed ? 'info' : 'success',
          text: result.refreshFailed
            ? '备份已恢复，但部分界面刷新失败；重新打开对应页面会再次读取'
            : '备份已恢复，账号、2FA 和服务信息已重新加载',
        })
      }
    } catch (error) {
      setNotice({ severity: 'error', text: `导入失败；已保留导入前自动备份：${error instanceof Error ? error.message : String(error)}` })
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <SettingsIcon sx={{ color: 'primary.main' }} />
        设置
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box sx={sectionSx()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850, lineHeight: 1.35 }}>
                  版本与更新
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.3 }}>
                  当前版本 v{appVersion || '-'}
                </Typography>
              </Box>
              <SystemUpdateAltIcon sx={{ color: 'text.secondary' }} />
            </Box>
            <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
              升级不会删除本地数据库，建议定期导出备份。
            </Alert>
            <Typography variant="body2" sx={{ fontWeight: 650, lineHeight: 1.55 }}>
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
            {updateStatus === 'error' && (
              <Alert severity="warning" variant="outlined" sx={{ mt: 1.5 }}>
                {updateStatusText}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.75 }}>
              <Button onClick={handleCheckUpdates} disabled={busy} startIcon={<SearchIcon />} variant="outlined">
                检查更新
              </Button>
              {updateStatus === 'available' && (
                <Button onClick={handleDownloadUpdate} disabled={busy} startIcon={<DownloadIcon />} variant="contained">
                  下载更新包
                </Button>
              )}
              {(updateStatus === 'downloaded' || updateStatus === 'installing') && (
                <Button
                  onClick={handleQuitAndInstall}
                  startIcon={<RestartAltIcon />}
                  color="success"
                  variant="contained"
                  disabled={Boolean(navigationBlockReason) || updateStatus === 'installing'}
                >
                  {updateStatus === 'installing' ? '正在安装' : '重启安装'}
                </Button>
              )}
            </Box>
          </Box>

          <Box sx={sectionSx()}>
            <Typography variant="subtitle2" sx={{ fontWeight: 850, lineHeight: 1.35, mb: 1.5 }}>
              数据
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                startIcon={<FileUploadIcon />}
                variant="outlined"
                onClick={() => setImportConfirmOpen(true)}
                disabled={Boolean(navigationBlockReason)}
              >
                导入数据库
              </Button>
              <Button startIcon={<FileDownloadIcon />} variant="outlined" onClick={handleExportDatabase}>
                导出数据库
              </Button>
              <Button startIcon={<FolderOpenIcon />} variant="outlined" onClick={() => window.electronAPI.openDataDirectory()}>
                打开数据目录
              </Button>
            </Box>
            {navigationBlockReason && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1.25 }}>
                请先保存或取消账号编辑，再恢复备份或重启安装更新。
              </Typography>
            )}
          </Box>

          <Box sx={sectionSx()}>
            <Typography variant="subtitle2" sx={{ fontWeight: 850, lineHeight: 1.35, mb: 1.5 }}>
              外观
            </Typography>
            <Button
              startIcon={themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              variant="outlined"
              onClick={toggleTheme}
            >
              {themeMode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
      </Dialog>
      <Dialog open={importConfirmOpen} onClose={() => setImportConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>恢复本地备份</DialogTitle>
        <DialogContent>
          <Alert severity="warning" variant="outlined" sx={{ mb: 1.5 }}>
            选择有效备份后，当前数据库内容会被备份并替换。
          </Alert>
          <Typography variant="body2" color="text.secondary">
            系统会先检查 JSON 结构或 SQLite 完整性；验证失败时不会开始覆盖。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportConfirmOpen(false)}>取消</Button>
          <Button variant="contained" color="warning" onClick={handleImportDatabase}>选择备份并继续</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={notice !== null} autoHideDuration={5000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.severity || 'info'} variant="filled" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </>
  )
}
