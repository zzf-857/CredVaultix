import React from 'react'
import { Box, Typography } from '@mui/material'

interface SectionLabelProps {
  children: React.ReactNode
  meta?: React.ReactNode
  action?: React.ReactNode
}

export default function SectionLabel({ children, meta, action }: SectionLabelProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 28, gap: 1, mb: 0.75 }}>
      <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
        {children}
      </Typography>
      {meta && (
        <Typography variant="caption" color="text.secondary">
          {meta}
        </Typography>
      )}
      {action}
    </Box>
  )
}
