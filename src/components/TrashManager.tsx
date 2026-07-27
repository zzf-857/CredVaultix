import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  LinearProgress,
  Snackbar,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { alpha } from '@mui/material/styles'
import { useStore } from '../stores/useStore'
import EmptyState from './common/EmptyState'
import PageHeader from './common/PageHeader'
import SectionLabel from './common/SectionLabel'

type DeleteTarget = { kind: 'account' | 'service'; id: string; name: string } | null

const itemSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 1.5,
  py: 1.25,
  bgcolor: 'surface.raised',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  '&:hover': { borderColor: 'border.strong' },
  transition: 'background-color 0.16s ease, border-color 0.16s ease',
}

function ItemIcon({ service = false }: { service?: boolean }) {
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: 1,
        display: 'grid',
        placeItems: 'center',
        bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
        color: 'error.main',
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.error.main, 0.25),
        flexShrink: 0,
      }}
    >
      {service ? <VpnKeyOutlinedIcon sx={{ fontSize: 19 }} /> : <DeleteOutlineIcon sx={{ fontSize: 19 }} />}
    </Box>
  )
}

export default function TrashManager() {
  const {
    trashAccounts,
    trashServices,
    loadTrashAccounts,
    loadTrashServices,
    restoreAccount,
    restoreSecretService,
    hardDeleteAccount,
    hardDeleteSecretService,
  } = useStore()
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [mutationKey, setMutationKey] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)

  const loadTrash = async () => {
    setLoadState('loading')
    setLoadError('')
    try {
      await Promise.all([loadTrashAccounts(), loadTrashServices()])
      setLoadState('ready')
    } catch (error) {
      setLoadError(`读取回收站失败：${error instanceof Error ? error.message : String(error)}`)
      setLoadState('error')
    }
  }

  const handleRestore = async (kind: 'account' | 'service', id: string) => {
    const key = `restore:${kind}:${id}`
    if (mutationKey) return
    setMutationKey(key)
    try {
      let result: { refreshFailed: boolean }
      if (kind === 'account') {
        result = await restoreAccount(id)
      } else {
        result = await restoreSecretService(id)
      }
      const successText = kind === 'account' ? '账号已恢复' : '服务信息已恢复'
      setNotice({
        severity: result.refreshFailed ? 'info' : 'success',
        text: result.refreshFailed ? `${successText}，但部分列表刷新失败` : successText,
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `恢复失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setMutationKey(null)
    }
  }

  useEffect(() => {
    void loadTrash()
  }, [loadTrashAccounts, loadTrashServices])

  const handleHardDelete = async () => {
    if (!deleteTarget || mutationKey) return
    const target = deleteTarget
    setMutationKey(`delete:${target.kind}:${target.id}`)
    try {
      let result: { refreshFailed: boolean }
      if (target.kind === 'account') {
        result = await hardDeleteAccount(target.id)
      } else {
        result = await hardDeleteSecretService(target.id)
      }
      setDeleteTarget(null)
      const successText = target.kind === 'account' ? '账号已彻底删除' : '服务信息已彻底删除'
      setNotice({
        severity: result.refreshFailed ? 'info' : 'success',
        text: result.refreshFailed ? `${successText}，但部分列表刷新失败` : successText,
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `彻底删除失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setMutationKey(null)
    }
  }

  const isEmpty = trashAccounts.length === 0 && trashServices.length === 0

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
      <PageHeader
        icon={<DeleteOutlineIcon sx={{ fontSize: 20, color: 'error.main' }} />}
        title="回收站"
        description={loadState === 'ready' ? `${trashAccounts.length + trashServices.length} 个已删除项目` : '正在读取已删除项目'}
      />

      {loadState === 'loading' && <LinearProgress aria-label="正在读取回收站" />}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
        {loadState === 'error' ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => { void loadTrash() }}>重试</Button>}
          >
            {loadError}
          </Alert>
        ) : loadState === 'ready' && isEmpty ? (
          <EmptyState
            icon={<DeleteOutlineIcon sx={{ fontSize: 23 }} />}
            title="回收站为空"
            description="移入回收站的账号和服务会显示在这里。"
          />
        ) : loadState === 'ready' ? (
          <Box sx={{ display: 'grid', gap: 2.5 }}>
          {trashAccounts.length > 0 && (
            <Box>
              <SectionLabel meta={`${trashAccounts.length} 项`}>账号</SectionLabel>
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                {trashAccounts.map((account) => (
                  <Box key={account.id} sx={itemSx}>
                    <ItemIcon />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{account.name}</Typography>
                      <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
                        账号：{account.username || '未设置'} · 删除时间：{account.deleted_at ? new Date(account.deleted_at).toLocaleString() : '未知'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<RestoreFromTrashIcon />}
                        disabled={Boolean(mutationKey)}
                        onClick={() => void handleRestore('account', account.id)}
                        aria-label={`恢复账号 ${account.name}`}
                      >恢复</Button>
                      <Button size="small" color="error" variant="outlined" disabled={Boolean(mutationKey)} onClick={() => setDeleteTarget({ kind: 'account', id: account.id, name: account.name })}>彻底删除</Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {trashServices.length > 0 && (
            <Box>
              <SectionLabel meta={`${trashServices.length} 项`}>服务信息</SectionLabel>
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                {trashServices.map((service) => (
                  <Box key={service.id} sx={itemSx}>
                    <ItemIcon service />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{service.name}</Typography>
                      <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
                        {service.description || '未填写用途'} · 删除时间：{service.deleted_at ? new Date(service.deleted_at).toLocaleString() : '未知'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<RestoreFromTrashIcon />}
                        disabled={Boolean(mutationKey)}
                        onClick={() => void handleRestore('service', service.id)}
                        aria-label={`恢复服务 ${service.name}`}
                      >恢复</Button>
                      <Button size="small" color="error" variant="outlined" disabled={Boolean(mutationKey)} onClick={() => setDeleteTarget({ kind: 'service', id: service.id, name: service.name })}>彻底删除</Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          </Box>
        ) : null}
      </Box>

      <Dialog open={deleteTarget !== null} onClose={() => { if (!mutationKey) setDeleteTarget(null) }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          确认彻底删除
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定永久删除“{deleteTarget?.name}”及其关联数据吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1.1, color: 'error.main', fontSize: '0.8rem' }}>
            {deleteTarget?.kind === 'service'
              ? '此操作不可逆，服务下的全部字段和字段组也会一并删除。'
              : '此操作不可逆。彻底删除账号后，关联的 2FA 会保留为孤立提醒。'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={Boolean(mutationKey)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleHardDelete} disabled={Boolean(mutationKey)}>
            {mutationKey?.startsWith('delete:') ? '删除中...' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={notice !== null} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.severity || 'success'} variant="filled" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}
