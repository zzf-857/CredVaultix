import React from 'react'
import { Box, Checkbox, IconButton, ListItemButton, Tooltip, Typography } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import type { SecretServiceRow } from '../../types'

export default function ServiceListItem({
  service,
  checked,
  selected,
  canDrag = true,
  onClick,
  onToggleSelected,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onToggleFavorite,
}: {
  service: SecretServiceRow
  checked: boolean
  selected: boolean
  canDrag?: boolean
  onClick: () => void
  onToggleSelected: () => void
  onDragStart: (serviceId: string) => void
  onDragEnd: () => void
  onDropBefore: (targetServiceId: string, droppedServiceId: string) => void
  onToggleFavorite: () => void
}) {
  return (
    <ListItemButton
      selected={selected}
      draggable={canDrag}
      onClick={onClick}
      onDragStart={(event) => {
        if (!canDrag) {
          event.preventDefault()
          return
        }
        event.dataTransfer.setData('text/plain', service.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(service.id)
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const droppedId = event.dataTransfer.getData('text/plain')
        if (droppedId && droppedId !== service.id) {
          onDropBefore(service.id, droppedId)
        }
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: '32px 24px 42px minmax(0, 1fr) 36px',
        alignItems: 'center',
        gap: 1.15,
        borderRadius: 2,
        mb: 1.05,
        px: 1.6,
        py: 1.45,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'transparent',
        borderLeft: '2px solid',
        borderLeftColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? 'action.selected' : (theme) => theme.palette.mode === 'dark' ? '#131313' : '#ffffff',
        '&:hover': {
          bgcolor: selected ? 'action.selected' : 'action.hover',
          borderColor: 'divider',
          borderLeftColor: selected ? 'primary.main' : 'divider',
        },
      }}
    >
      <Checkbox
        size="small"
        checked={checked}
        onClick={(event) => event.stopPropagation()}
        onChange={onToggleSelected}
        inputProps={{ 'aria-label': `选择 ${service.name}` }}
        sx={{ p: 0.35 }}
      />
      <Tooltip title={canDrag ? '拖动调整顺序或分组' : '切换到手动排序后可拖动'}>
        <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled', opacity: canDrag ? 1 : 0.35 }} />
      </Tooltip>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: service.is_favorite ? 'rgba(255, 183, 134, 0.16)' : 'rgba(173, 198, 255, 0.10)',
          color: service.is_favorite ? 'warning.main' : 'primary.main',
          border: '1px solid',
          borderColor: service.is_favorite ? 'rgba(255, 183, 134, 0.42)' : 'rgba(173, 198, 255, 0.28)',
        }}
      >
        <VpnKeyOutlinedIcon sx={{ fontSize: 20 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.95rem', lineHeight: 1.42 }}>
          {service.name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', mt: 0.35, fontSize: '0.78rem', lineHeight: 1.42 }}>
          {service.description || service.url || '未填写用途说明'}
        </Typography>
      </Box>
      <Tooltip title={service.is_favorite ? '取消收藏' : '收藏'}>
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          sx={{ width: 30, height: 30 }}
        >
          {service.is_favorite ? (
            <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
          ) : (
            <StarBorderIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          )}
        </IconButton>
      </Tooltip>
    </ListItemButton>
  )
}
