import React from 'react'
import { Box, Button, Divider, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'
import AccountBoxIcon from '@mui/icons-material/AccountBox'
import SecurityIcon from '@mui/icons-material/Security'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import { useStore } from '../stores/useStore'

const navItems = [
  {
    view: 'accounts' as const,
    label: '账号管理',
    helper: '账号、密码、标签、自定义字段',
    icon: AccountBoxIcon,
    color: '#adc6ff',
  },
  {
    view: 'service-info' as const,
    label: '服务信息',
    helper: 'API Key、Secret、服务器资料',
    icon: VpnKeyIcon,
    color: '#ffb786',
  },
  {
    view: '2fa' as const,
    label: '2FA 验证器',
    helper: 'TOTP、HOTP 与临时验证码',
    icon: SecurityIcon,
    color: '#b7c8e1',
  },
  {
    view: 'trash' as const,
    label: '废纸篓',
    helper: '恢复或彻底删除账号',
    icon: DeleteOutlineIcon,
    color: '#ffb4ab',
  },
]

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { activeView, setActiveView } = useStore()

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: collapsed ? 1 : 1.5,
          pt: collapsed ? 1.25 : 2,
          pb: collapsed ? 1 : 1.5,
          minHeight: collapsed ? 58 : 116,
          display: 'flex',
          alignItems: collapsed ? 'center' : 'flex-start',
          justifyContent: collapsed ? 'center' : 'flex-start',
          flexDirection: 'column',
        }}
      >
        {collapsed ? (
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2.25,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: (theme) => theme.palette.mode === 'dark' ? '#001a42' : '#ffffff',
              fontWeight: 900,
            }}
          >
            C
          </Box>
        ) : (
          <>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              本地保险库
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
              账号与服务信息
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.75, lineHeight: 1.45 }}>
              本地管理账号、2FA 与自定义密钥资料。
            </Typography>
          </>
        )}
      </Box>

      <Divider sx={{ mx: collapsed ? 1 : 1.5, mb: 1 }} />

      <List dense disablePadding sx={{ px: collapsed ? 0.75 : 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const selected = activeView === item.view

          return (
            <Tooltip key={item.view} title={collapsed ? item.label : ''} placement="right">
              <ListItemButton
                selected={selected}
                onClick={() => setActiveView(item.view)}
                sx={{
                  minHeight: collapsed ? 44 : 52,
                  borderRadius: 2,
                  mb: 0.5,
                  px: collapsed ? 1 : 1.25,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderLeft: '2px solid',
                  borderLeftColor: selected ? 'primary.main' : 'transparent',
                  '&.Mui-selected': {
                    color: (theme) => theme.palette.mode === 'dark' ? '#d8e2ff' : '#0b57d0',
                    '& .MuiListItemText-secondary': {
                      color: (theme) => theme.palette.mode === 'dark' ? '#d3e4fe' : '#315d94',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: item.color }}>
                  <Icon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    secondary={item.helper}
                    primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 800, noWrap: true }}
                    secondaryTypographyProps={{ fontSize: '0.72rem', noWrap: true }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          )
        })}
      </List>

      <Box sx={{ mt: 'auto', p: collapsed ? 0.75 : 1 }}>
        <Tooltip title={collapsed ? '打开数据目录' : ''} placement="right">
          <Button
            fullWidth
            size="small"
            startIcon={collapsed ? undefined : <FolderOpenIcon />}
            onClick={() => window.electronAPI.openDataDirectory()}
            variant={collapsed ? 'text' : 'outlined'}
            sx={{
              minWidth: 0,
              height: collapsed ? 44 : 36,
              px: collapsed ? 0.5 : 1,
              color: 'text.secondary',
              borderColor: 'divider',
            }}
          >
            {collapsed ? <FolderOpenIcon fontSize="small" /> : '打开数据目录'}
          </Button>
        </Tooltip>
      </Box>
    </Box>
  )
}
