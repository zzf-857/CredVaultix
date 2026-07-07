import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../stores/useStore'
import type { SecretFieldGroupRow, SecretFieldRow } from '../../types'
import { getGroupedItems, sortServiceInfoItems } from '../../utils/serviceInfoGrouping'
import BatchActionBar from './BatchActionBar'
import ServiceFieldGroup from './ServiceFieldGroup'

const GROUP_COLORS = ['#adc6ff', '#b7c8e1', '#ffb786', '#8ddc9f', '#ffb4ab', '#c4b5fd']

export default function ServiceDetail() {
  const {
    clearSelectedFieldIds,
    loadServiceDetail,
    loadServiceInfo,
    selectedFieldIds,
    selectedServiceDetail,
    setSelectedService,
    toggleSelectedFieldId,
  } = useStore()

  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null)
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<SecretFieldRow | null>(null)
  const [editingGroup, setEditingGroup] = useState<SecretFieldGroupRow | null>(null)
  const [fieldName, setFieldName] = useState('')
  const [fieldValue, setFieldValue] = useState('')
  const [fieldIsSecret, setFieldIsSecret] = useState(true)
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [targetGroupId, setTargetGroupId] = useState('')

  const fields = selectedServiceDetail?.fields || []
  const fieldGroups = selectedServiceDetail?.fieldGroups || []
  const groupedFields = useMemo(() => getGroupedItems(sortServiceInfoItems(fields, 'manual')), [fields])

  if (!selectedServiceDetail) {
    return (
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, bgcolor: 'background.default' }}>
        <Box sx={{ textAlign: 'center', px: 4.25, py: 5.25, maxWidth: 420, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
          <VpnKeyOutlinedIcon sx={{ fontSize: 56, color: 'primary.main', opacity: 0.32, mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', mb: 1, fontWeight: 800 }}>
            选择一个服务信息
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
            在左侧选择服务后，可以查看和整理它的自定义字段与字段组。
          </Typography>
        </Box>
      </Box>
    )
  }

  const { service } = selectedServiceDetail

  const refreshDetail = async () => {
    await loadServiceDetail(service.id)
  }

  const openCreateFieldDialog = () => {
    setEditingField(null)
    setFieldName('')
    setFieldValue('')
    setFieldIsSecret(true)
    setFieldDialogOpen(true)
  }

  const openEditFieldDialog = (field: SecretFieldRow) => {
    setEditingField(field)
    setFieldName(field.field_name)
    setFieldValue(field.field_value)
    setFieldIsSecret(Boolean(field.is_secret))
    setFieldDialogOpen(true)
  }

  const saveField = async () => {
    const name = fieldName.trim()
    if (!name) return

    if (editingField) {
      await window.electronAPI.updateSecretField(editingField.id, {
        fieldName: name,
        fieldValue,
        isSecret: fieldIsSecret,
      })
    } else {
      await window.electronAPI.createSecretField({
        id: uuidv4(),
        serviceId: service.id,
        fieldName: name,
        fieldValue,
        isSecret: fieldIsSecret,
      })
    }

    setFieldDialogOpen(false)
    setEditingField(null)
    await refreshDetail()
  }

  const deleteField = async (field: SecretFieldRow) => {
    const confirmed = window.confirm(`删除字段“${field.field_name}”？`)
    if (!confirmed) return
    await window.electronAPI.deleteSecretField(field.id)
    await refreshDetail()
  }

  const openCreateGroupDialog = () => {
    setEditingGroup(null)
    setGroupName('')
    setGroupColor(GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const openRenameGroupDialog = (group: SecretFieldGroupRow) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupColor(group.color || GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const saveGroup = async () => {
    const name = groupName.trim()
    if (!name) return

    if (editingGroup) {
      await window.electronAPI.updateSecretFieldGroup(editingGroup.id, { name, color: groupColor })
    } else {
      const result = await window.electronAPI.createSecretFieldGroup({
        id: uuidv4(),
        serviceId: service.id,
        name,
        color: groupColor,
      })
      if (selectedFieldIds.length > 0) {
        await window.electronAPI.moveSecretFields({ ids: selectedFieldIds, groupId: result.id })
        clearSelectedFieldIds()
      }
    }

    setGroupDialogOpen(false)
    setEditingGroup(null)
    await refreshDetail()
  }

  const deleteGroup = async (group: SecretFieldGroupRow) => {
    const confirmed = window.confirm(`删除字段分组“${group.name}”？分组内字段会移到未分组。`)
    if (!confirmed) return
    await window.electronAPI.deleteSecretFieldGroup(group.id)
    await refreshDetail()
  }

  const toggleGroupCollapsed = async (group: SecretFieldGroupRow) => {
    await window.electronAPI.updateSecretFieldGroup(group.id, { isCollapsed: group.is_collapsed ? 0 : 1 })
    await refreshDetail()
  }

  const moveSelectedToExistingGroup = async () => {
    if (selectedFieldIds.length === 0 || !targetGroupId) return
    await window.electronAPI.moveSecretFields({ ids: selectedFieldIds, groupId: targetGroupId })
    setMoveDialogOpen(false)
    setTargetGroupId('')
    clearSelectedFieldIds()
    await refreshDetail()
  }

  const ungroupSelected = async () => {
    if (selectedFieldIds.length === 0) return
    await window.electronAPI.moveSecretFields({ ids: selectedFieldIds, groupId: null })
    clearSelectedFieldIds()
    await refreshDetail()
  }

  const dropToGroup = async (groupId: string | null, fieldId: string) => {
    const ids = selectedFieldIds.includes(fieldId) ? selectedFieldIds : [fieldId]
    await window.electronAPI.moveSecretFields({ ids, groupId })
    setDraggingFieldId(null)
    await refreshDetail()
  }

  const deleteService = async () => {
    const confirmed = window.confirm(`删除服务“${service.name}”？`)
    if (!confirmed) return
    await window.electronAPI.deleteSecretService(service.id)
    setSelectedService(null)
    await loadServiceInfo()
  }

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box sx={{ px: 3.1, py: 2.55, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2.2 }}>
          <Box sx={{ minWidth: 0, display: 'flex', gap: 1.95 }}>
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
                border: '1px solid',
                borderColor: 'divider',
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <VpnKeyOutlinedIcon sx={{ fontSize: 31 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap sx={{ fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.3 }}>
                {service.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.55, fontSize: '0.92rem', lineHeight: 1.55 }}>
                {service.description || '未填写用途说明'}
              </Typography>
              {service.url && (
                <Typography variant="caption" noWrap sx={{ display: 'block', color: 'primary.main', mt: 0.75, lineHeight: 1.35 }}>
                  {service.url}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Tooltip title="编辑服务">
              <span>
                <IconButton size="small" disabled>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="删除服务">
              <IconButton size="small" onClick={deleteService}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 2.65, py: 1.65, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', gap: 1.35, flexWrap: 'wrap', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 1.2 }}>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreateFieldDialog}>
            新建字段
          </Button>
          <Button size="small" startIcon={<CreateNewFolderIcon />} onClick={openCreateGroupDialog}>
            新建字段组
          </Button>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center', fontSize: '0.76rem', lineHeight: 1.45 }}>
          {fields.length} 个字段
        </Typography>
      </Box>

      <BatchActionBar
        count={selectedFieldIds.length}
        onClear={clearSelectedFieldIds}
        onCreateGroup={openCreateGroupDialog}
        onMoveToGroup={() => setMoveDialogOpen(true)}
        onUngroup={ungroupSelected}
      />

      <Box sx={{ flex: 1, overflowY: 'auto', p: 3.1 }}>
        <ServiceFieldGroup
          title="未分组"
          fields={groupedFields.ungrouped}
          selectedIds={selectedFieldIds}
          draggingFieldId={draggingFieldId}
          onToggleSelected={toggleSelectedFieldId}
          onEditField={openEditFieldDialog}
          onDeleteField={deleteField}
          onToggleCollapsed={toggleGroupCollapsed}
          onRenameGroup={openRenameGroupDialog}
          onDeleteGroup={deleteGroup}
          onDropToGroup={dropToGroup}
          onDragStart={setDraggingFieldId}
        />
        {fieldGroups
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-Hans-CN'))
          .map((group) => (
            <ServiceFieldGroup
              key={group.id}
              title={group.name}
              color={group.color}
              group={group}
              fields={groupedFields.groups[group.id] || []}
              selectedIds={selectedFieldIds}
              draggingFieldId={draggingFieldId}
              onToggleSelected={toggleSelectedFieldId}
              onEditField={openEditFieldDialog}
              onDeleteField={deleteField}
              onToggleCollapsed={toggleGroupCollapsed}
              onRenameGroup={openRenameGroupDialog}
              onDeleteGroup={deleteGroup}
              onDropToGroup={dropToGroup}
              onDragStart={setDraggingFieldId}
            />
          ))}
      </Box>

      <Dialog open={fieldDialogOpen} onClose={() => setFieldDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingField ? '编辑字段' : '新建字段'}</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <TextField
            autoFocus
            fullWidth
            label="字段名称"
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="字段值"
            value={fieldValue}
            onChange={(event) => setFieldValue(event.target.value)}
            sx={{ mt: 2 }}
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox checked={fieldIsSecret} onChange={(event) => setFieldIsSecret(event.target.checked)} />}
            label="敏感字段"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFieldDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={saveField} disabled={!fieldName.trim()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingGroup ? '重命名字段组' : '新建字段组'}</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <TextField
            autoFocus
            fullWidth
            label="字段组名称"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {GROUP_COLORS.map((color) => (
              <IconButton
                key={color}
                size="small"
                onClick={() => setGroupColor(color)}
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  bgcolor: color,
                  border: '2px solid',
                  borderColor: groupColor === color ? 'text.primary' : 'transparent',
                  '&:hover': { bgcolor: color },
                }}
                aria-label={`选择颜色 ${color}`}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={saveGroup} disabled={!groupName.trim()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>移入字段组</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <FormControl fullWidth>
            <InputLabel id="service-field-move-label">目标字段组</InputLabel>
            <Select
              labelId="service-field-move-label"
              label="目标字段组"
              value={targetGroupId}
              onChange={(event) => setTargetGroupId(event.target.value)}
            >
              {fieldGroups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={moveSelectedToExistingGroup} disabled={!targetGroupId}>
            移动
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
