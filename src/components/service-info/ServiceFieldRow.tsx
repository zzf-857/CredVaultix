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
import useCopyFeedback from '../../hooks/useCopyFeedback'
import { hasDragType, SERVICE_FIELD_DRAG_TYPE } from './dragTypes'

export default function ServiceFieldRow({
  field,
  checked,
  onToggleSelected,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  field: SecretFieldRow
  checked: boolean
  onToggleSelected: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: (fieldId: string) => void
  onDragEnd: () => void
  onDropBefore: (targetFieldId: string, droppedFieldId: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const { copiedKey, copy } = useCopyFeedback()
  const isSecret = Boolean(field.is_secret)
  const copied = copiedKey === field.id
  const displayedValue = isSecret && !visible ? '••••••••' : field.field_value

  const copyValue = () => copy(field.field_value, field.id)

  return (
    <Box
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(SERVICE_FIELD_DRAG_TYPE, field.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart(field.id)
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!hasDragType(Array.from(event.dataTransfer.types), SERVICE_FIELD_DRAG_TYPE)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        if (!hasDragType(Array.from(event.dataTransfer.types), SERVICE_FIELD_DRAG_TYPE)) return
        event.preventDefault()
        event.stopPropagation()
        const droppedId = event.dataTransfer.getData(SERVICE_FIELD_DRAG_TYPE)
        if (droppedId && droppedId !== field.id) {
          onDropBefore(field.id, droppedId)
        }
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: '28px 18px minmax(0, 1fr) 124px',
        alignItems: 'center',
        gap: 0.75,
        minWidth: 0,
        px: 1.25,
        py: 0.875,
        borderBottom: '1px solid',
        borderColor: copied ? 'success.main' : 'border.subtle',
        bgcolor: copied ? 'rgba(52, 168, 83, 0.12)' : 'transparent',
        boxShadow: copied ? 'inset 0 0 0 1px rgba(52, 168, 83, 0.75)' : 'none',
        overflow: 'hidden',
        transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        '&:last-child': { borderBottom: 0 },
        '&:hover': {
          bgcolor: copied ? 'rgba(52, 168, 83, 0.16)' : 'action.hover',
        },
      }}
    >
      <Checkbox
        size="small"
        checked={checked}
        onChange={onToggleSelected}
        onClick={(event) => event.stopPropagation()}
        inputProps={{ 'aria-label': `选择字段 ${field.field_name}` }}
        sx={{ p: 0.35 }}
      />
      <DragIndicatorIcon aria-label={`拖动字段 ${field.field_name}`} sx={{ fontSize: 17, color: 'text.disabled' }} />
      <Box
        component="button"
        type="button"
        aria-label={`复制字段 ${field.field_name}`}
        onClick={() => { void copyValue() }}
        sx={{
          all: 'unset',
          minWidth: 0,
          alignSelf: 'stretch',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          cursor: 'pointer',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: copied ? 'success.main' : 'primary.main',
            outlineOffset: 2,
          },
        }}
      >
        <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', fontWeight: 600 }}>
          {field.field_name}
        </Typography>
        <Typography variant="body2" noWrap className={isSecret ? 'mono-data' : undefined} sx={{ color: 'text.primary', mt: 0.2, fontSize: '0.875rem', lineHeight: 1.4, fontWeight: 500 }}>
          {displayedValue || '(空)'}
        </Typography>
      </Box>
      <Box
        sx={{
          width: 124,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 28px)',
          alignItems: 'center',
          justifyContent: 'end',
          gap: 0.25,
        }}
      >
        {isSecret && (
          <Tooltip title={visible ? '隐藏' : '显示'}>
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation()
                setVisible(!visible)
              }}
              aria-label={`${visible ? '隐藏' : '显示'}字段 ${field.field_name}`}
              sx={{ width: 28, height: 28 }}
            >
              {visible ? <VisibilityOffIcon sx={{ fontSize: 17 }} /> : <VisibilityIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Tooltip>
        )}
        {!isSecret && <Box aria-hidden sx={{ width: 28, height: 28 }} />}
        <Tooltip title={copied ? '已复制' : '复制'}>
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              void copyValue()
            }}
            aria-label={`${copied ? '已复制' : '复制'}字段 ${field.field_name}`}
            sx={{ width: 28, height: 28, color: copied ? 'success.main' : 'text.secondary' }}
          >
            {copied ? <CheckIcon sx={{ fontSize: 17 }} /> : <ContentCopyIcon sx={{ fontSize: 17 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="编辑字段">
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onEdit()
            }}
            aria-label={`编辑字段 ${field.field_name}`}
            sx={{ width: 28, height: 28 }}
          >
            <EditOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="删除字段">
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            aria-label={`删除字段 ${field.field_name}`}
            sx={{ width: 28, height: 28 }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
