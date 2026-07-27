import React from 'react'
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import CloseIcon from '@mui/icons-material/Close'
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
      PaperProps={{ sx: { maxWidth: 600 } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2.5,
          py: 1.75,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'surface.raised',
            border: '1px solid',
            borderColor: 'border.subtle',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <AccountCircleOutlinedIcon sx={{ fontSize: 21 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
            新建主账号
          </Typography>
        </Box>
        <Tooltip title="关闭">
          <span>
            <IconButton size="small" aria-label="关闭账号类型选择" onClick={onClose} disabled={busy}>
              <CloseIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </span>
        </Tooltip>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, pt: 2, pb: 2.25 }}>
        <Box sx={{ display: 'grid', gap: 1 }}>
          {OPTIONS.map((option, index) => (
            <ButtonBase
              key={option.platform}
              type="button"
              autoFocus={index === 0}
              aria-label={`选择${option.title}`}
              aria-describedby={`account-platform-${option.platform}-description`}
              disabled={busy}
              onClick={() => { if (!busy) onSelect(option.platform) }}
              sx={{
                width: '100%',
                px: 1.75,
                py: 1.5,
                minHeight: 84,
                display: 'block',
                textAlign: 'left',
                color: 'text.primary',
                border: '1px solid',
                borderRadius: 1,
                cursor: busy ? 'wait' : 'pointer',
                borderColor: 'border.subtle',
                bgcolor: 'surface.raised',
                transition: 'background-color 0.16s ease, border-color 0.16s ease',
                '&:hover': {
                  borderColor: option.accent,
                  bgcolor: 'action.hover',
                },
                '&.Mui-focusVisible': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
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
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.35 }}>
                    {option.title}
                  </Typography>
                  <Typography id={`account-platform-${option.platform}-description`} variant="body2" sx={{ color: 'text.secondary' }}>
                    {option.description}
                  </Typography>
                </Box>
              </Box>
            </ButtonBase>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'border.subtle' }}>
        <Button onClick={onClose} disabled={busy}>{busy ? '创建中...' : '取消'}</Button>
      </DialogActions>
    </Dialog>
  )
}
