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
  busy?: boolean
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
  busy = false,
}: AccountPlatformDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => { if (!busy) onClose() }}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxWidth: 660 } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.6,
          px: 3,
          pt: 2.6,
          pb: 2.2,
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.25,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(173, 198, 255, 0.13)',
            border: '1px solid',
            borderColor: 'rgba(173, 198, 255, 0.28)',
            color: 'primary.main',
            flexShrink: 0,
            mt: 0.1,
          }}
        >
          <AccountCircleOutlinedIcon />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 850, fontSize: '1.18rem', lineHeight: 1.32 }}>
            选择主账号类型
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.65, lineHeight: 1.58 }}>
            先选择这个主账号属于哪一类，后面再填写邮箱、密码、2FA 和平台标签。
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2.35, pb: 2.75 }}>
        <Box
          sx={{
            px: 2,
            py: 1.55,
            mb: 2.25,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#171717' : '#f8fafd',
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800, lineHeight: 1.4, mb: 0.45 }}>
            当前支持范围
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.68 }}>
            1.x 版本专注整理 Google 和 Microsoft 主账号；其他网站或应用先作为平台标签记录在主账号下。
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1.85 }}>
          {OPTIONS.map((option) => (
            <Paper
              key={option.platform}
              variant="outlined"
              aria-disabled={busy}
              onClick={() => { if (!busy) onSelect(option.platform) }}
              sx={{
                px: 2.6,
                py: 2.35,
                minHeight: 104,
                borderRadius: 3,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.62 : 1,
                borderColor: `${option.accent}66`,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
                '&:hover': {
                  borderColor: option.accent,
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2.25,
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
                <Box sx={{ minWidth: 0, pt: 0.15 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 850, fontSize: '0.98rem', lineHeight: 1.38, mb: 0.65 }}>
                    {option.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.88rem', lineHeight: 1.68 }}>
                    {option.description}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} disabled={busy}>{busy ? '创建中...' : '取消'}</Button>
      </DialogActions>
    </Dialog>
  )
}
