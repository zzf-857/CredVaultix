import React from 'react'
import { Box, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface SectionLabelProps {
  children: React.ReactNode
  meta?: React.ReactNode
  action?: React.ReactNode
  collapsed?: boolean
  onToggle?: () => void
}

export default function SectionLabel({ children, meta, action, collapsed = false, onToggle }: SectionLabelProps) {
  const title = (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      {onToggle && (
        <ExpandMoreIcon
          sx={{
            fontSize: 16,
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      )}
      {children}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 28, gap: 1, mb: 0.75 }}>
      {onToggle ? (
        <Box
          component="button"
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            p: 0,
            border: 0,
            background: 'none',
            color: 'inherit',
            cursor: 'pointer',
            textAlign: 'left',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <Typography variant="overline" color="text.secondary" component="span" sx={{ display: 'block', minWidth: 0 }}>
            {title}
          </Typography>
        </Box>
      ) : (
        <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
          {title}
        </Typography>
      )}
      {meta && (
        <Typography variant="caption" color="text.secondary">
          {meta}
        </Typography>
      )}
      {action}
    </Box>
  )
}
