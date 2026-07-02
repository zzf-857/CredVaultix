import React, { useState } from 'react'
import { Box, Checkbox, IconButton, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import type { SecretFieldRow } from '../../types'

export default function ServiceFieldRow({
  field,
  checked,
  onToggleSelected,
  onEdit,
  onDelete,
  onDragStart,
}: {
  field: SecretFieldRow
  checked: boolean
  onToggleSelected: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: (fieldId: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const isSecret = Boolean(field.is_secret)
  const displayedValue = isSecret && !visible ? '••••••••' : field.field_value

  const copyValue = async () => {
    await navigator.clipboard.writeText(field.field_value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Box
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', field.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(field.id)
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: '28px 22px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 1,
        m: 0.75,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#ffffff',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
        },
      }}
    >
      <Checkbox
        size="small"
        checked={checked}
        onChange={onToggleSelected}
        inputProps={{ 'aria-label': `选择字段 ${field.field_name}` }}
        sx={{ p: 0.25 }}
      />
      <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', fontWeight: 800 }}>
          {field.field_name}
        </Typography>
        <Typography variant="body2" noWrap className={isSecret ? 'mono-data' : undefined} sx={{ color: 'text.primary' }}>
          {displayedValue || '(空)'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {isSecret && (
          <Tooltip title={visible ? '隐藏' : '显示'}>
            <IconButton size="small" onClick={() => setVisible(!visible)}>
              {visible ? <VisibilityOffIcon sx={{ fontSize: 17 }} /> : <VisibilityIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={copied ? '已复制' : '复制'}>
          <IconButton size="small" onClick={copyValue} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
            {copied ? <CheckIcon sx={{ fontSize: 17 }} /> : <ContentCopyIcon sx={{ fontSize: 17 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="编辑字段">
          <IconButton size="small" onClick={onEdit}>
            <EditOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="删除字段">
          <IconButton size="small" onClick={onDelete}>
            <DeleteOutlineIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
