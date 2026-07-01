import React from 'react'
import { Box, Button, Divider, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'
import AccountBoxIcon from '@mui/icons-material/AccountBox'
import SecurityIcon from '@mui/icons-material/Security'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import { useStore } from '../stores/useStore'

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { activeView, setActiveView } = useStore()

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, pt: 2.5, pb: 1.5, display: collapsed ? 'none' : 'block' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.12em' }}>
          CredVaultix
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
          账号与服务信息
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem', mt: 0.75 }}>
          本地管理账号、2FA 与自定义密钥资料。
        </Typography>
      </Box>

      <Divider sx={{ mx: collapsed ? 1 : 2, mb: 1, mt: collapsed ? 1 : 0 }} />

      <List dense disablePadding sx={{ px: 1 }}>
        <Tooltip title={collapsed ? '账号管理' : ''} placement="right">
          <ListItemButton
            selected={activeView === 'accounts'}
            onClick={() => setActiveView('accounts')}
            sx={{ borderRadius: 2, mb: 0.5, justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36 }}>
              <AccountBoxIcon sx={{ fontSize: 20, color: '#a8c7fa' }} />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="账号管理"
                secondary="Google / Microsoft 主账号"
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: '0.74rem' }}
              />
            )}
          </ListItemButton>
        </Tooltip>

        <Tooltip title={collapsed ? '服务信息' : ''} placement="right">
          <ListItemButton
            selected={activeView === 'service-info'}
            onClick={() => setActiveView('service-info')}
            sx={{ borderRadius: 2, mb: 0.5, justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36 }}>
              <VpnKeyIcon sx={{ fontSize: 20, color: '#f6c177' }} />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="服务信息"
                secondary="API Key / Secret / 自定义资料"
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: '0.74rem' }}
              />
            )}
          </ListItemButton>
        </Tooltip>

        <Tooltip title={collapsed ? '2FA 验证器' : ''} placement="right">
          <ListItemButton
            selected={activeView === '2fa'}
            onClick={() => setActiveView('2fa')}
            sx={{ borderRadius: 2, mb: 0.5, justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36 }}>
              <SecurityIcon sx={{ fontSize: 20, color: '#78d9ec' }} />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="2FA 验证器"
                secondary="独立查看并可跳回账号"
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: '0.74rem' }}
              />
            )}
          </ListItemButton>
        </Tooltip>

        <Tooltip title={collapsed ? '废纸篓' : ''} placement="right">
          <ListItemButton
            selected={activeView === 'trash'}
            onClick={() => setActiveView('trash')}
            sx={{ borderRadius: 2, justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36 }}>
              <DeleteOutlineIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="废纸篓"
                secondary="恢复或彻底删除账号"
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: '0.74rem' }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </List>

      <Box sx={{ mt: 'auto', p: 1 }}>
        <Tooltip title={collapsed ? '打开数据目录' : ''} placement="right">
          <Button
            fullWidth
            size="small"
            startIcon={collapsed ? undefined : <FolderOpenIcon />}
            onClick={() => window.electronAPI.openDataDirectory()}
            sx={{ minWidth: 0, px: collapsed ? 0.5 : 1 }}
          >
            {collapsed ? <FolderOpenIcon fontSize="small" /> : '打开数据目录'}
          </Button>
        </Tooltip>
      </Box>
    </Box>
  )
}
