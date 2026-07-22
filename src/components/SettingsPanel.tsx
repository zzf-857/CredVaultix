import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'
import { useStore } from '../stores/useStore'
import type { UpdateSnapshot } from '../types'

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

function getUpdateStatusText(update: UpdateSnapshot | null) {
  if (!update) return '正在读取更新状态...'

  switch (update.status) {
    case 'checking':
      return '正在连接 GitHub 检查更新...'
    case 'available':
      return `发现新版本 v${update.availableVersion || '-'}，可下载更新包`
    case 'latest':
      return '当前已是最新版本'
    case 'downloading':
      return '正在下载并校验更新包...'
    case 'downloaded':
      return `新版本 v${update.downloadedVersion || update.availableVersion || '-'} 已下载完成`
    case 'installing':
      return '正在创建安全备份并启动安装向导...'
    case 'error':
      return getFriendlyUpdateError(update.error || undefined)
    case 'unsupported':
      if (update.distribution === 'portable') return '当前为便携版，请从 GitHub Releases 手动更新'
      if (update.distribution === 'unmanaged') return '当前程序不在安装器管理目录中，请手动更新'
      return '开发环境不执行自动更新'
    default:
      return '点击检查更新以获取 GitHub 最新版本'
  }
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
  const [updateState, setUpdateState] = useState<UpdateSnapshot | null>(null)
  const [updateRequestError, setUpdateRequestError] = useState<string | null>(null)
  const latestUpdateRevision = useRef(-1)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)

  const applyUpdateSnapshot = useCallback((snapshot: UpdateSnapshot) => {
    if (snapshot.revision < latestUpdateRevision.current) return false
    latestUpdateRevision.current = snapshot.revision
    setUpdateState(snapshot)
    setUpdateRequestError(null)
    return true
  }, [])

  useEffect(() => {
    let active = true
    const applySnapshot = (snapshot: UpdateSnapshot) => {
      if (active) applyUpdateSnapshot(snapshot)
    }

    const unsubscribe = window.electronAPI.onUpdateMessage(applySnapshot)
    window.electronAPI.getUpdateState().then(applySnapshot).catch((error) => {
      if (active) setUpdateRequestError(getFriendlyUpdateError(error instanceof Error ? error.message : String(error)))
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [applyUpdateSnapshot])

  const handleCheckUpdates = async () => {
    try {
      const result = await window.electronAPI.checkUpdates()
      applyUpdateSnapshot(result.snapshot)
      if (!result.success) setUpdateRequestError(getFriendlyUpdateError(result.error))
    } catch (error) {
      setUpdateRequestError(getFriendlyUpdateError(error instanceof Error ? error.message : String(error)))
    }
  }

  const handleDownloadUpdate = async () => {
    try {
      const result = await window.electronAPI.downloadUpdate()
      applyUpdateSnapshot(result.snapshot)
      if (!result.success) {
        setUpdateRequestError(getFriendlyUpdateError(result.error || '下载更新失败，请稍后再试'))
      }
    } catch (error) {
      setUpdateRequestError(getFriendlyUpdateError(error instanceof Error ? error.message : String(error)))
    }
  }

  const handleInstallUpdate = async () => {
    if (updateState?.status === 'installing') return
    try {
      const result = await window.electronAPI.installUpdate()
      applyUpdateSnapshot(result.snapshot)
      if (!result.success) setUpdateRequestError(getFriendlyUpdateError(result.error))
    } catch (error) {
      setUpdateRequestError(getFriendlyUpdateError(error instanceof Error ? error.message : String(error)))
    }
  }

  const handleOpenReleasePage = async () => {
    try {
      const result = await window.electronAPI.openExternal(
        updateState?.releaseUrl || 'https://github.com/zzf-857/CredVaultix/releases/latest'
      )
      if (!result.success) setUpdateRequestError(result.error || '无法打开 GitHub Releases')
    } catch (error) {
      setUpdateRequestError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleOpenUpdateLog = async () => {
    try {
      const result = await window.electronAPI.openUpdateLog()
      if (!result.success) setUpdateRequestError(result.error || '无法打开更新日志目录')
    } catch (error) {
      setUpdateRequestError(error instanceof Error ? error.message : String(error))
    }
  }

  const updateStatus = updateState?.status || 'idle'
  const updateStatusText = getUpdateStatusText(updateState)
  const downloadPercent = updateState?.percent || 0
  const displayedUpdateError = updateRequestError || updateState?.error
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
                  当前版本 v{updateState?.currentVersion || '-'}
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
            {displayedUpdateError && (
              <Alert severity="warning" variant="outlined" sx={{ mt: 1.5 }}>
                {getFriendlyUpdateError(displayedUpdateError)}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.75 }}>
              <Button
                onClick={handleCheckUpdates}
                disabled={busy || Boolean(updateState?.canInstall) || updateStatus === 'unsupported'}
                startIcon={<SearchIcon />}
                variant="outlined"
              >
                检查更新
              </Button>
              {updateStatus === 'available' && (
                <Button onClick={handleDownloadUpdate} disabled={busy} startIcon={<DownloadIcon />} variant="contained">
                  下载更新包
                </Button>
              )}
              {(updateState?.canInstall || updateStatus === 'installing') && (
                <Button
                  onClick={handleInstallUpdate}
                  startIcon={<RestartAltIcon />}
                  color="success"
                  variant="contained"
                  disabled={Boolean(navigationBlockReason) || updateStatus === 'installing'}
                >
                  {updateStatus === 'installing' ? '正在安装' : '重启安装'}
                </Button>
              )}
              <Button onClick={handleOpenReleasePage} startIcon={<OpenInNewIcon />} variant="outlined">
                GitHub Releases
              </Button>
              <Button onClick={handleOpenUpdateLog} startIcon={<FolderOpenIcon />} variant="text">
                打开更新日志
              </Button>
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
