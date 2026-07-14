import React from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'
import AccountBoxIcon from '@mui/icons-material/AccountBox'
import SecurityIcon from '@mui/icons-material/Security'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SettingsIcon from '@mui/icons-material/Settings'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import appIcon from '../../assets/app.png'
import { useStore } from '../stores/useStore'
import SettingsPanel from './SettingsPanel'

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
    label: '回收站',
    helper: '恢复或彻底删除账号与服务',
    icon: DeleteOutlineIcon,
    color: '#ffb4ab',
  },
]

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { activeView, setActiveView, navigationBlockReason, setNavigationBlockReason } = useStore()
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [pendingView, setPendingView] = React.useState<(typeof navItems)[number]['view'] | null>(null)

  const requestViewChange = (view: (typeof navItems)[number]['view']) => {
    if (view === activeView) return
    if (navigationBlockReason) {
      setPendingView(view)
      return
    }
    setActiveView(view)
  }

  const discardAndNavigate = () => {
    if (!pendingView) return
    setNavigationBlockReason(null)
    setActiveView(pendingView)
    setPendingView(null)
  }

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
          px: collapsed ? 1 : 1.75,
          pt: collapsed ? 1.25 : 1.75,
          pb: collapsed ? 1 : 1.55,
          minHeight: collapsed ? 58 : 86,
          display: 'flex',
          alignItems: collapsed ? 'center' : 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        {collapsed ? (
          <Box
            component="img"
            src={appIcon}
            alt="CredVaultix"
            sx={{
              width: 44,
              height: 44,
              display: 'block',
              objectFit: 'contain',
              bgcolor: 'transparent',
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.15, minWidth: 0 }}>
            <Box
              component="img"
              src={appIcon}
              alt="CredVaultix"
              sx={{
                width: 48,
                height: 48,
                display: 'block',
                objectFit: 'contain',
                bgcolor: 'transparent',
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 850, fontSize: '1rem', lineHeight: 1.25 }}>
                CredVaultix
              </Typography>
              <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', mt: 0.25, lineHeight: 1.35 }}>
                本地账号与服务信息库
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Divider sx={{ mx: collapsed ? 1 : 1.75, mb: 1.2 }} />

      <List dense disablePadding sx={{ px: collapsed ? 0.75 : 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const selected = activeView === item.view

          return (
            <Tooltip key={item.view} title={collapsed ? item.label : ''} placement="right">
              <ListItemButton
                selected={selected}
                onClick={() => requestViewChange(item.view)}
                sx={{
                  minHeight: collapsed ? 44 : 52,
                  borderRadius: 2,
                  mb: 0.65,
                  px: collapsed ? 1 : 1.5,
                  py: collapsed ? 0.75 : 1.05,
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
                    sx={{ my: 0 }}
                    primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 800, lineHeight: 1.32, noWrap: true }}
                    secondaryTypographyProps={{ fontSize: '0.72rem', lineHeight: 1.35, noWrap: true }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          )
        })}
      </List>

      <Box sx={{ mt: 'auto', p: collapsed ? 0.75 : 1 }}>
        <Tooltip title={collapsed ? '设置' : ''} placement="right">
          <Button
            fullWidth
            size="small"
            startIcon={collapsed ? undefined : <SettingsIcon />}
            onClick={() => setSettingsOpen(true)}
            variant={collapsed ? 'text' : 'outlined'}
            sx={{
              minWidth: 0,
              height: collapsed ? 44 : 38,
              px: collapsed ? 0.5 : 1.25,
              color: 'text.secondary',
              borderColor: 'divider',
            }}
          >
            {collapsed ? <SettingsIcon fontSize="small" /> : '设置'}
          </Button>
        </Tooltip>
      </Box>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Dialog open={pendingView !== null} onClose={() => setPendingView(null)} maxWidth="xs" fullWidth>
        <DialogTitle>放弃未保存修改？</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {navigationBlockReason || '当前页面存在未保存修改'}。切换页面会丢失这些内容。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingView(null)}>继续编辑</Button>
          <Button color="error" variant="contained" onClick={discardAndNavigate}>放弃并切换</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
