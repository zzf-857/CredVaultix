import React from 'react'
import { Box, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SecretFieldGroupRow, SecretFieldRow } from '../../types'
import ServiceFieldRow from './ServiceFieldRow'

export default function ServiceFieldGroup({
  title,
  color,
  group,
  fields,
  selectedIds,
  draggingFieldId,
  onToggleSelected,
  onEditField,
  onDeleteField,
  onToggleCollapsed,
  onRenameGroup,
  onDeleteGroup,
  onDropToGroup,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  title: string
  color?: string
  group?: SecretFieldGroupRow
  fields: SecretFieldRow[]
  selectedIds: string[]
  draggingFieldId: string | null
  onToggleSelected: (id: string) => void
  onEditField: (field: SecretFieldRow) => void
  onDeleteField: (field: SecretFieldRow) => void
  onToggleCollapsed: (group: SecretFieldGroupRow) => void
  onRenameGroup: (group: SecretFieldGroupRow) => void
  onDeleteGroup: (group: SecretFieldGroupRow) => void
  onDropToGroup: (groupId: string | null, fieldId: string) => void
  onDragStart: (fieldId: string) => void
  onDragEnd: () => void
  onDropBefore: (targetFieldId: string, droppedFieldId: string) => void
}) {
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null)
  const collapsed = Boolean(group?.is_collapsed)

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const droppedId = event.dataTransfer.getData('text/plain') || draggingFieldId
    if (droppedId) {
      onDropToGroup(group?.id || null, droppedId)
    }
  }

  return (
    <Box
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      sx={{
        mb: 2.35,
        border: '1px solid',
        borderColor: draggingFieldId ? 'primary.main' : 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.1,
          px: 1.55,
          minHeight: 48,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
          borderBottom: collapsed || fields.length === 0 ? 0 : '1px solid',
          borderColor: 'divider',
        }}
      >
        {group ? (
          <Tooltip title={collapsed ? '展开分组' : '折叠分组'}>
            <IconButton size="small" onClick={() => onToggleCollapsed(group)}>
              {collapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : (
          <Box sx={{ width: 30 }} />
        )}
        <Box sx={{ width: 8, height: 18, borderRadius: 99, bgcolor: color || 'divider' }} />
        <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0, color: 'text.secondary', fontWeight: 800, fontSize: '0.76rem', lineHeight: 1.45, textTransform: 'uppercase' }}>
          {title} ({fields.length})
        </Typography>
        {group && (
          <>
            <Tooltip title="字段分组菜单">
              <IconButton size="small" onClick={(event) => setMenuAnchor(event.currentTarget)}>
                <MoreHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null)
                  onRenameGroup(group)
                }}
              >
                重命名
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null)
                  onDeleteGroup(group)
                }}
              >
                删除分组
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {!collapsed && (
        <Box sx={{ minHeight: fields.length ? 0 : 40 }}>
          {fields.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', px: 5.25, py: 1.5, color: 'text.disabled', fontSize: '0.76rem', lineHeight: 1.5 }}>
              暂无字段
            </Typography>
          ) : (
            fields.map((field) => (
              <ServiceFieldRow
                key={field.id}
                field={field}
                checked={selectedIds.includes(field.id)}
                onToggleSelected={() => onToggleSelected(field.id)}
                onEdit={() => onEditField(field)}
                onDelete={() => onDeleteField(field)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDropBefore={onDropBefore}
              />
            ))
          )}
        </Box>
      )}
    </Box>
  )
}
