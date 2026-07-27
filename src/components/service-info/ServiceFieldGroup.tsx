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
        mb: 1.5,
        border: '1px solid',
        borderColor: draggingFieldId ? 'primary.main' : 'border.subtle',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          minHeight: 40,
          bgcolor: 'surface.raised',
          borderBottom: collapsed || fields.length === 0 ? 0 : '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        {group ? (
          <Tooltip title={collapsed ? '展开分组' : '折叠分组'}>
            <IconButton
              size="small"
              onClick={() => onToggleCollapsed(group)}
              aria-label={`${collapsed ? '展开' : '折叠'}字段组 ${group.name}`}
              sx={{ width: 28, height: 28 }}
            >
              {collapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : (
          <Box sx={{ width: 28 }} />
        )}
        <Box sx={{ width: 3, height: 14, borderRadius: 1, bgcolor: color || 'border.strong' }} />
        <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0, color: 'text.secondary', fontWeight: 600 }}>
          {title} ({fields.length})
        </Typography>
        {group && (
          <>
            <Tooltip title="字段分组菜单">
              <IconButton
                size="small"
                onClick={(event) => setMenuAnchor(event.currentTarget)}
                aria-label={`${group.name} 字段分组菜单`}
                sx={{ width: 28, height: 28 }}
              >
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
        <Box sx={{ minHeight: fields.length ? 0 : 36 }}>
          {fields.length === 0 ? (
            <Typography variant="caption" sx={{ display: 'block', pl: 5.75, py: 1.25, color: 'text.disabled' }}>
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
