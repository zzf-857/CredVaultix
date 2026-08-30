import React from 'react'
import { Box } from '@mui/material'
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined'
import type { ModelProvider } from './modelProviders'
import { getModelProviderById } from './modelProviders'

export interface ProviderIconProps {
  provider?: ModelProvider | null
  providerId?: string | null
  size?: number
  decorative?: boolean
  className?: string
}

export default function ProviderIcon({
  provider,
  providerId,
  size = 32,
  decorative = true,
  className,
}: ProviderIconProps) {
  const resolvedProvider = provider || getModelProviderById(providerId)
  const label = resolvedProvider?.name || '自定义厂商'
  const iconSize = Math.max(16, Math.round(size * 0.62))

  return (
    <Box
      component="span"
      className={className}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `${label}图标`}
      sx={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: 'inline-grid',
        placeItems: 'center',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'border.subtle',
        borderRadius: 1,
        bgcolor: 'surface.raised',
        color: 'text.primary',
      }}
    >
      {resolvedProvider?.icon ? (
        <Box
          component="img"
          src={resolvedProvider.icon}
          alt=""
          sx={{
            width: iconSize,
            height: iconSize,
            display: 'block',
            objectFit: 'contain',
            filter: resolvedProvider.monochromeIcon
              ? (theme) => theme.palette.mode === 'dark' ? 'invert(1)' : 'none'
              : 'none',
          }}
        />
      ) : (
        <ApiOutlinedIcon sx={{ fontSize: iconSize, color: 'text.secondary' }} />
      )}
    </Box>
  )
}
