import React from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'
import AccountBoxIcon from '@mui/icons-material/AccountBox'
import SecurityIcon from '@mui/icons-material/Security'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SettingsIcon from '@mui/icons-material/Settings'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import { useStore } from '../stores/useStore'
import SettingsPanel from './SettingsPanel'

const navItems = [
  {
    view: 'accounts' as const,
    label: '账号管理',
    icon: AccountBoxIcon,
    color: 'primary.main',
  },
  {
    view: 'service-info' as const,
    label: '服务信息',
    icon: VpnKeyIcon,
    color: 'warning.main',
  },
  {
    view: '2fa' as const,
    label: '2FA 验证器',
    icon: SecurityIcon,
    color: 'secondary.main',
  },
  {
    view: 'trash' as const,
    label: '回收站',
    icon: DeleteOutlineIcon,
    color: 'error.main',
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
      {!collapsed && (
        <Typography
          variant="overline"
          sx={{ px: 2, pt: 1.7, pb: 0.8, color: 'text.secondary', display: 'block' }}
        >
          保险库
        </Typography>
      )}

      <List dense disablePadding sx={{ px: collapsed ? 0.75 : 1, pt: collapsed ? 1 : 0 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const selected = activeView === item.view

          return (
            <Tooltip key={item.view} title={collapsed ? item.label : ''} placement="right">
              <ListItemButton
                aria-current={selected ? 'page' : undefined}
                aria-label={item.label}
                selected={selected}
                onClick={() => requestViewChange(item.view)}
                sx={{
                  minHeight: 42,
                  mb: 0.35,
                  px: collapsed ? 1 : 1.2,
                  py: 0.7,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 4,
                    top: 11,
                    bottom: 11,
                    width: 2,
                    borderRadius: 2,
                    bgcolor: selected ? 'primary.main' : 'transparent',
                  },
                  '&.Mui-selected': {
                    color: 'text.primary',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: collapsed ? 0 : 34, color: item.color, justifyContent: 'center' }}>
                  <Icon sx={{ fontSize: 19 }} />
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={item.label}
                    sx={{ my: 0 }}
                    primaryTypographyProps={{ fontSize: '0.86rem', fontWeight: selected ? 600 : 500, lineHeight: 1.3, noWrap: true }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          )
        })}
      </List>

      <Box sx={{ mt: 'auto', p: collapsed ? 0.75 : 1 }}>
        <Divider sx={{ mb: 0.75 }} />
        <Tooltip title={collapsed ? '设置' : ''} placement="right">
          <Button
            aria-label="设置"
            fullWidth
            size="small"
            startIcon={collapsed ? undefined : <SettingsIcon />}
            onClick={() => setSettingsOpen(true)}
            variant="text"
            sx={{
              minWidth: 0,
              height: 38,
              px: collapsed ? 0.5 : 1.25,
              color: 'text.secondary',
              justifyContent: collapsed ? 'center' : 'flex-start',
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
