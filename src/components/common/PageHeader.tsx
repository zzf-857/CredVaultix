import React from 'react'
import { Box, Typography } from '@mui/material'

interface PageHeaderProps {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  compact?: boolean
}

export default function PageHeader({ icon, title, description, actions, compact = false }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: compact ? 60 : 68,
        px: compact ? 2 : 2.5,
        py: compact ? 1.2 : 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      {icon && (
        <Box
          sx={{
            width: compact ? 36 : 40,
            height: compact ? 36 : 40,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'surface.raised',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" noWrap sx={{ fontSize: compact ? '1rem' : '1.08rem' }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          {actions}
        </Box>
      )}
    </Box>
  )
}
