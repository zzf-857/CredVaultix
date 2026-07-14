import React from 'react'
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SecretGroupRow, SecretServiceRow } from '../../types'
import ServiceListItem from './ServiceListItem'

function groupTitle(name: string, count: number) {
  return `${name} (${count})`
}

export default function ServiceGroupList({
  title,
  color,
  group,
  services,
  selectedServiceId,
  selectedServiceIds,
  canDrag = true,
  draggingServiceId,
  onSelectService,
  onToggleServiceSelected,
  onToggleFavorite,
  onToggleCollapsed,
  onRenameGroup,
  onDeleteGroup,
  onDropToGroup,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  title: string
  color?: string
  group?: SecretGroupRow
  services: SecretServiceRow[]
  selectedServiceId: string | null
  selectedServiceIds: string[]
  canDrag?: boolean
  draggingServiceId: string | null
  onSelectService: (id: string) => void
  onToggleServiceSelected: (id: string) => void
  onToggleFavorite: (service: SecretServiceRow) => void
  onToggleCollapsed?: (group: SecretGroupRow) => void
  onRenameGroup?: (group: SecretGroupRow) => void
  onDeleteGroup?: (group: SecretGroupRow) => void
  onDropToGroup: (groupId: string | null, serviceId: string) => void
  onDragStart: (serviceId: string) => void
  onDragEnd: () => void
  onDropBefore: (targetServiceId: string, droppedServiceId: string) => void
}) {
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null)
  const collapsed = Boolean(group?.is_collapsed)

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const droppedId = event.dataTransfer.getData('text/plain') || draggingServiceId
    if (droppedId) {
      onDropToGroup(group?.id || null, droppedId)
    }
  }

  return (
    <Box
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      sx={{
        px: 1.35,
        py: 1.15,
        mx: 1.1,
        my: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: draggingServiceId ? 'primary.main' : 'transparent',
        bgcolor: draggingServiceId
          ? 'action.hover'
          : (theme) => theme.palette.mode === 'dark' ? '#131313' : '#ffffff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minHeight: 42, px: 0.45 }}>
        {group ? (
          <Tooltip title={collapsed ? '展开分组' : '折叠分组'}>
            <IconButton size="small" onClick={() => onToggleCollapsed?.(group)}>
              {collapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : (
          <Box sx={{ width: 30 }} />
        )}
        <Box sx={{ width: 8, height: 18, borderRadius: 99, bgcolor: color || 'divider' }} />
        <Typography variant="caption" sx={{ flex: 1, minWidth: 0, fontWeight: 800, color: 'text.secondary', fontSize: '0.76rem', lineHeight: 1.45, textTransform: 'uppercase' }} noWrap>
          {groupTitle(title, services.length)}
        </Typography>
        {group && (
          <>
            <Tooltip title="分组菜单">
              <IconButton size="small" onClick={(event) => setMenuAnchor(event.currentTarget)}>
                <MoreHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null)
                  onRenameGroup?.(group)
                }}
              >
                重命名
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null)
                  onDeleteGroup?.(group)
                }}
              >
                删除分组
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {!collapsed && (
        <Box sx={{ pt: 0.65, minHeight: services.length ? 0 : 32 }}>
          {services.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', px: 5.25, py: 1.45, color: 'text.disabled', fontSize: '0.76rem', lineHeight: 1.5 }}>
              暂无服务
            </Typography>
          ) : (
            services.map((service) => (
              <ServiceListItem
                key={service.id}
                service={service}
                checked={selectedServiceIds.includes(service.id)}
                selected={selectedServiceId === service.id}
                canDrag={canDrag}
                onClick={() => onSelectService(service.id)}
                onToggleSelected={() => onToggleServiceSelected(service.id)}
                onToggleFavorite={() => onToggleFavorite(service)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDropBefore={onDropBefore}
              />
            ))
          )}
        </Box>
      )}
    </Box>
  )
}
