import React from 'react'
import { Box, Checkbox, IconButton, Tooltip, Typography } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import type { SecretServiceRow } from '../../types'
import ProviderIcon from './ProviderIcon'

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
    <Box
      draggable={canDrag}
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
        gridTemplateColumns: '26px 18px minmax(0, 1fr) 30px',
        alignItems: 'center',
        gap: 0.75,
        width: '100%',
        minWidth: 0,
        mb: 0.25,
        px: 1,
        py: 0.625,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'transparent',
        borderRadius: 1,
        bgcolor: selected ? 'action.selected' : 'transparent',
        overflow: 'hidden',
        '&:hover': {
          bgcolor: selected ? 'action.selected' : 'action.hover',
          borderColor: selected ? 'primary.main' : 'border.subtle',
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
        <Box component="span" sx={{ display: 'grid', placeItems: 'center' }}>
          <DragIndicatorIcon sx={{ fontSize: 17, color: 'text.disabled', opacity: canDrag ? 1 : 0.35 }} />
        </Box>
      </Tooltip>
      <Box
        component="button"
        type="button"
        aria-current={selected ? 'true' : undefined}
        aria-label={`打开服务 ${service.name}`}
        onClick={onClick}
        sx={{
          display: 'grid',
          gridTemplateColumns: '34px minmax(0, 1fr)',
          alignItems: 'center',
          gap: 0.75,
          minWidth: 0,
          p: 0,
          border: 0,
          bgcolor: 'transparent',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {service.provider_id ? (
          <ProviderIcon providerId={service.provider_id} size={32} />
        ) : (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'surface.raised',
              color: service.is_favorite ? 'warning.main' : 'primary.main',
              border: '1px solid',
              borderColor: service.is_favorite ? 'warning.main' : 'border.subtle',
            }}
          >
            <VpnKeyOutlinedIcon sx={{ fontSize: 18 }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.875rem', lineHeight: 1.35 }}>
            {service.name}
          </Typography>
          <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', mt: 0.15 }}>
            {service.description || service.url || '未填写用途说明'}
          </Typography>
        </Box>
      </Box>
      <Tooltip title={service.is_favorite ? '取消收藏' : '收藏'}>
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          aria-label={`${service.is_favorite ? '取消收藏' : '收藏'} ${service.name}`}
          sx={{ width: 28, height: 28 }}
        >
          {service.is_favorite ? (
            <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
          ) : (
            <StarBorderIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  )
}
