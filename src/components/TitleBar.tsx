import React from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import MinimizeIcon from '@mui/icons-material/Remove'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import CloseIcon from '@mui/icons-material/Close'
import appIcon from '../../assets/app.png'
import { useStore } from '../stores/useStore'

const viewLabels = {
  accounts: '账号管理',
  'service-info': '服务信息',
  '2fa': '2FA 验证器',
  trash: '回收站',
} as const

export default function TitleBar() {
  const activeView = useStore((state) => state.activeView)

  return (
    <Box
      className="drag-region"
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 44,
        pl: 1.4,
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Box component="img" src={appIcon} alt="" sx={{ width: 22, height: 22, objectFit: 'contain' }} />
        <Typography variant="body2" sx={{ fontWeight: 650, lineHeight: 1 }}>
          CredVaultix
        </Typography>
        <Box sx={{ width: '1px', height: 16, bgcolor: 'divider', mx: 0.25 }} />
        <Typography variant="caption" color="text.secondary" noWrap>
          {viewLabels[activeView]}
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }} />

      <Box className="no-drag" sx={{ display: 'flex', alignSelf: 'stretch' }}>
        <Tooltip title="最小化" enterDelay={600}>
          <IconButton
            aria-label="最小化窗口"
            onClick={() => window.electronAPI.minimize()}
            sx={{ color: 'text.secondary', borderRadius: 0, width: 44, height: 43 }}
          >
            <MinimizeIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="最大化" enterDelay={600}>
          <IconButton
            aria-label="最大化窗口"
            onClick={() => window.electronAPI.maximize()}
            sx={{ color: 'text.secondary', borderRadius: 0, width: 44, height: 43 }}
          >
            <CropSquareIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="关闭" enterDelay={600}>
          <IconButton
            aria-label="关闭窗口"
            onClick={() => window.electronAPI.close()}
            sx={{
              color: 'text.secondary',
              borderRadius: 0,
              width: 44,
              height: 43,
              '&:hover': { bgcolor: '#c42b1c', color: '#ffffff' },
            }}
          >
            <CloseIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
