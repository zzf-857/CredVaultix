import React from 'react'
import { Box, Checkbox, IconButton, ListItemButton, Tooltip, Typography } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
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
        gridTemplateColumns: '28px 24px minmax(0, 1fr) 32px',
        alignItems: 'center',
        gap: 0.75,
        borderRadius: 1,
        mb: 0.5,
        px: 1,
        py: 0.85,
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
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
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
