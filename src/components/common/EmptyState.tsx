import React from 'react'
import { Box, Typography } from '@mui/material'

interface EmptyStateProps {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
}

export default function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 440,
        mx: 'auto',
        py: compact ? 4 : 7,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: compact ? 40 : 48,
          height: compact ? 40 : 48,
          display: 'grid',
          placeItems: 'center',
          mx: 'auto',
          mb: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'surface.raised',
          color: 'text.secondary',
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle1">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  )
}
