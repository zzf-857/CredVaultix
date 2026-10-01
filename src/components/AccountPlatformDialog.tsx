import React, { useRef } from 'react'
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
import { ACCOUNT_PLATFORM_OPTIONS, type AccountPlatform } from '../utils/accountPlatform'
import PlatformIcon from './accounts/PlatformIcon'
import { ACCOUNT_PLATFORM_ACCENTS } from './accounts/AccountFields'

interface AccountPlatformDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (platform: AccountPlatform) => void
  busy?: boolean
}

export default function AccountPlatformDialog({
  open,
  onClose,
  onSelect,
  busy = false,
}: AccountPlatformDialogProps) {
  const firstOptionRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog
      open={open}
      onClose={() => { if (!busy) onClose() }}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxWidth: 600 } }}
      TransitionProps={{ onEntered: () => { if (!busy) firstOptionRef.current?.focus() } }}
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
          {ACCOUNT_PLATFORM_OPTIONS.map((option, index) => (
            <ButtonBase
              key={option.platform}
              ref={index === 0 ? firstOptionRef : undefined}
              type="button"
              autoFocus={index === 0}
              aria-label={`选择${option.label} 主账号`}
              aria-describedby={`account-platform-${option.platform}-description`}
              disabled={busy}
              onClick={() => { if (!busy) onSelect(option.platform) }}
              sx={{
                width: '100%',
                px: 1.75,
                py: 1.5,
                minHeight: 76,
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
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
                '&.Mui-focusVisible': {
                  borderColor: 'primary.main',
                  bgcolor: 'action.hover',
                },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    bgcolor: `${ACCOUNT_PLATFORM_ACCENTS[option.platform]}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PlatformIcon platform={option.platform} size={24} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.35 }}>
                    {option.label} 主账号
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
