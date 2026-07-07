import React, { useEffect, useState } from 'react'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useStore } from '../stores/useStore'

export default function TrashManager() {
  const { trashAccounts, loadTrashAccounts, restoreAccount, hardDeleteAccount } = useStore()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadTrashAccounts()
  }, [])

  const handleRestore = async (id: string) => {
    await restoreAccount(id)
  }

  const handleHardDelete = async () => {
    if (confirmDeleteId) {
      await hardDeleteAccount(confirmDeleteId)
      setConfirmDeleteId(null)
    }
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ mb: 3, p: 2.75, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
              border: '1px solid',
              borderColor: 'divider',
              color: 'primary.main',
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.25 }}>
              回收站
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.6, lineHeight: 1.5 }}>
              已删除账号会保留在本地，直到你选择恢复或彻底删除。
            </Typography>
          </Box>
        </Box>
      </Box>

      {trashAccounts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 4, border: '1px dashed', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
          <DeleteOutlineIcon sx={{ fontSize: 56, color: 'text.secondary', opacity: 0.35, mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 800 }}>
            回收站空空如也
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, lineHeight: 1.55 }}>
            被移入回收站的账号会显示在这里。
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {trashAccounts.map(acc => (
            <Box key={acc.id} sx={{ 
              display: 'flex', alignItems: 'center', gap: 2.25, p: 2.25,
              bgcolor: 'background.paper',
              border: '1px solid', borderColor: 'divider', borderRadius: 3,
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              transition: 'background-color 0.2s ease, border-color 0.2s ease'
            }}>
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
                <DeleteOutlineIcon />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.35 }}>{acc.name}</Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.3, lineHeight: 1.4 }}>
                  账号: {acc.username || '未设置'} • 删除时间: {acc.deleted_at ? new Date(acc.deleted_at).toLocaleString() : '未知'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button 
                  size="small" 
                  variant="contained"
                  color="primary"
                  disableElevation
                  startIcon={<RestoreFromTrashIcon />} 
                  onClick={() => handleRestore(acc.id)}
                >
                  恢复账号
                </Button>
                <Button 
                  size="small" 
                  color="error" 
                  variant="outlined" 
                  onClick={() => setConfirmDeleteId(acc.id)}
                >
                  彻底删除
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Delete confirmation */}
      <Dialog open={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          确认彻底删除
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.55 }}>确定要彻底从设备中清除该账号的所有数据吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1.1, color: 'error.main', fontSize: '0.8rem', lineHeight: 1.5 }}>
            此操作不可逆。彻底删除后，关联的 2FA 实时验证码将失去账号关联变孤立状态。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>取消操作</Button>
          <Button variant="contained" color="error" onClick={handleHardDelete}>确认粉碎</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
