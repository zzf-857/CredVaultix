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
import { useStore } from '../stores/useStore'

type DeleteTarget = { kind: 'account' | 'service'; id: string; name: string } | null

const itemSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 2.25,
  p: 2.25,
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 3,
  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
  transition: 'background-color 0.2s ease, border-color 0.2s ease',
}

function ItemIcon({ service = false }: { service?: boolean }) {
  return (
    <Box
      sx={{
        width: 42,
        height: 42,
        borderRadius: 2,
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'rgba(255,180,171,0.12)',
        color: 'error.main',
        border: '1px solid rgba(255,180,171,0.28)',
        flexShrink: 0,
      }}
    >
      {service ? <VpnKeyOutlinedIcon /> : <DeleteOutlineIcon />}
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
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ mb: 3, p: 2.75, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <ItemIcon />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.25 }}>
              回收站
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.6, lineHeight: 1.5 }}>
              已删除账号与服务会保留在本地，直到你选择恢复或彻底删除。
            </Typography>
          </Box>
        </Box>
      </Box>

      {loadState === 'loading' ? (
        <LinearProgress aria-label="正在读取回收站" />
      ) : loadState === 'error' ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => { void loadTrash() }}>重试</Button>}
        >
          {loadError}
        </Alert>
      ) : isEmpty ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 4, border: '1px dashed', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
          <DeleteOutlineIcon sx={{ fontSize: 56, color: 'text.secondary', opacity: 0.35, mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 800 }}>回收站空空如也</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>被移入回收站的账号和服务会显示在这里。</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 3 }}>
          {trashAccounts.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 800 }}>账号（{trashAccounts.length}）</Typography>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {trashAccounts.map((account) => (
                  <Box key={account.id} sx={itemSx}>
                    <ItemIcon />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{account.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        账号：{account.username || '未设置'} · 删除时间：{account.deleted_at ? new Date(account.deleted_at).toLocaleString() : '未知'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="contained" startIcon={<RestoreFromTrashIcon />} disabled={Boolean(mutationKey)} onClick={() => void handleRestore('account', account.id)}>恢复账号</Button>
                      <Button size="small" color="error" variant="outlined" disabled={Boolean(mutationKey)} onClick={() => setDeleteTarget({ kind: 'account', id: account.id, name: account.name })}>彻底删除</Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {trashServices.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 800 }}>服务信息（{trashServices.length}）</Typography>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {trashServices.map((service) => (
                  <Box key={service.id} sx={itemSx}>
                    <ItemIcon service />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{service.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {service.description || '未填写用途'} · 删除时间：{service.deleted_at ? new Date(service.deleted_at).toLocaleString() : '未知'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="contained" startIcon={<RestoreFromTrashIcon />} disabled={Boolean(mutationKey)} onClick={() => void handleRestore('service', service.id)}>恢复服务</Button>
                      <Button size="small" color="error" variant="outlined" disabled={Boolean(mutationKey)} onClick={() => setDeleteTarget({ kind: 'service', id: service.id, name: service.name })}>彻底删除</Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

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
