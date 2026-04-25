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
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 4, overflowY: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <DeleteOutlineIcon sx={{ color: 'primary.main', fontSize: 28 }} /> 
          回收站
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          已经被删除的账号会被暂时存放在此处。由于目前系统未启用自动清理策略，它们会一直保留，直到您主观选择“彻底删除”为止。彻底删除后所有对应的自定义字段也会一并抹除。
        </Typography>
      </Box>

      {trashAccounts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <DeleteOutlineIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.2, mb: 2 }} />
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            回收站空空如也
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {trashAccounts.map(acc => (
            <Box key={acc.id} sx={{ 
              display: 'flex', alignItems: 'center', p: 2.5, 
              bgcolor: 'background.paper',
              border: '1px solid', borderColor: 'divider', borderRadius: 2,
              '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
              transition: 'all 0.2s ease-in-out'
            }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{acc.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  账号: {acc.username || '未设置'} • 删除时间: {acc.deleted_at ? new Date(acc.deleted_at).toLocaleString() : '未知'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
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
        <DialogContent>
          <Typography variant="body2">确定要彻底从设备中清除该账号的所有数据吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'error.main', fontSize: '0.8rem' }}>
            ⚠️ 此操作不可逆！彻底删除后，关联的 2FA 实时验证码将失去账号关联变孤立状态。
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
