import React from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Typography,
} from '@mui/material'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import type { AccountPlatform } from '../utils/accountPlatform'

interface AccountPlatformDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (platform: AccountPlatform) => void
}

const OPTIONS: Array<{
  platform: AccountPlatform
  title: string
  description: string
  accent: string
}> = [
  {
    platform: 'google',
    title: 'Google 主账号',
    description: '适合记录 Gmail、Google 登录、Google Cloud 和用 Google 登录的平台。',
    accent: '#81c995',
  },
  {
    platform: 'microsoft',
    title: 'Microsoft 主账号',
    description: '适合记录 Outlook、Microsoft 登录、Azure 和相关平台访问。',
    accent: '#a8c7fa',
  },
]

export default function AccountPlatformDialog({
  open,
  onClose,
  onSelect,
}: AccountPlatformDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>选择主账号类型</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, mt: 0.5 }}>
          1.x 版本只聚焦管理 Google 和 Microsoft 主账号。第三方平台先通过标签记录。
        </Typography>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {OPTIONS.map((option) => (
            <Paper
              key={option.platform}
              variant="outlined"
              onClick={() => onSelect(option.platform)}
              sx={{
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                borderColor: `${option.accent}66`,
                '&:hover': {
                  borderColor: option.accent,
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    bgcolor: `${option.accent}22`,
                    color: option.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AccountCircleOutlinedIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {option.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                    {option.description}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
      </DialogActions>
    </Dialog>
  )
}
