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
        px: 1,
        py: 0.5,
        borderBottom: '1px solid',
        borderColor: draggingServiceId ? 'primary.main' : 'border.subtle',
        bgcolor: draggingServiceId ? 'action.hover' : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 36 }}>
        {group ? (
          <Tooltip title={collapsed ? '展开分组' : '折叠分组'}>
            <IconButton
              size="small"
              onClick={() => onToggleCollapsed?.(group)}
              aria-label={`${collapsed ? '展开' : '折叠'}分组 ${group.name}`}
              sx={{ width: 28, height: 28 }}
            >
              {collapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : (
          <Box sx={{ width: 28 }} />
        )}
        <Box sx={{ width: 3, height: 14, borderRadius: 1, bgcolor: color || 'border.strong' }} />
        <Typography variant="caption" sx={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'text.secondary' }} noWrap>
          {groupTitle(title, services.length)}
        </Typography>
        {group && (
          <>
            <Tooltip title="分组菜单">
              <IconButton
                size="small"
                onClick={(event) => setMenuAnchor(event.currentTarget)}
                aria-label={`${group.name} 分组菜单`}
                sx={{ width: 28, height: 28 }}
              >
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
        <Box sx={{ pt: 0.25, minHeight: services.length ? 0 : 30 }}>
          {services.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', pl: 5.75, py: 1, color: 'text.disabled' }}>
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
