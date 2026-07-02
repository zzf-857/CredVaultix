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
  onClick,
  onToggleSelected,
  onDragStart,
  onToggleFavorite,
}: {
  service: SecretServiceRow
  checked: boolean
  selected: boolean
  onClick: () => void
  onToggleSelected: () => void
  onDragStart: (serviceId: string) => void
  onToggleFavorite: () => void
}) {
  return (
    <ListItemButton
      selected={selected}
      draggable
      onClick={onClick}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', service.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(service.id)
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: '28px 20px 36px minmax(0, 1fr) 32px',
        alignItems: 'center',
        gap: 0.75,
        borderRadius: 2,
        mb: 0.75,
        px: 1,
        py: 1,
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
        sx={{ p: 0.25 }}
      />
      <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: service.is_favorite ? 'rgba(255, 183, 134, 0.16)' : 'rgba(173, 198, 255, 0.10)',
          color: service.is_favorite ? 'warning.main' : 'primary.main',
          border: '1px solid',
          borderColor: service.is_favorite ? 'rgba(255, 183, 134, 0.42)' : 'rgba(173, 198, 255, 0.28)',
        }}
      >
        <VpnKeyOutlinedIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 800, color: 'text.primary' }}>
          {service.name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
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
