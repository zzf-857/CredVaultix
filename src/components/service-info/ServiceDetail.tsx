import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../stores/useStore'
import type { SecretFieldGroupRow, SecretFieldRow } from '../../types'
import { getGroupedItems, moveIdsBefore, sortServiceInfoItems } from '../../utils/serviceInfoGrouping'
import BatchActionBar from './BatchActionBar'
import ServiceFieldGroup from './ServiceFieldGroup'

const GROUP_COLORS = ['#adc6ff', '#b7c8e1', '#ffb786', '#8ddc9f', '#ffb4ab', '#c4b5fd']

type DeleteTarget = {
  kind: 'field' | 'field-group' | 'service'
  id: string
  name: string
} | null

export default function ServiceDetail() {
  const {
    clearSelectedFieldIds,
    allAccounts: accounts,
    loadAllAccounts,
    loadServiceDetail,
    loadServiceInfo,
    selectedFieldIds,
    selectedServiceDetail,
    setSelectedService,
    toggleSelectedFieldId,
    navigateToAccount,
  } = useStore()

  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null)
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<SecretFieldRow | null>(null)
  const [editingGroup, setEditingGroup] = useState<SecretFieldGroupRow | null>(null)
  const [serviceName, setServiceName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [serviceUrl, setServiceUrl] = useState('')
  const [serviceNotes, setServiceNotes] = useState('')
  const [serviceLinkedAccountId, setServiceLinkedAccountId] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [fieldValue, setFieldValue] = useState('')
  const [fieldIsSecret, setFieldIsSecret] = useState(true)
  const [fieldValueVisible, setFieldValueVisible] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [targetGroupId, setTargetGroupId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  const fields = selectedServiceDetail?.fields || []
  const fieldGroups = selectedServiceDetail?.fieldGroups || []
  const groupedFields = useMemo(() => getGroupedItems(sortServiceInfoItems(fields, 'manual')), [fields])

  useEffect(() => {
    if (accounts.length === 0) {
      void loadAllAccounts()
    }
  }, [accounts.length, loadAllAccounts])

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
  const linkedAccount = accounts.find((account) => account.id === service.linked_account_id)

  const refreshDetail = async () => {
    await loadServiceDetail(service.id)
  }

  const openEditServiceDialog = () => {
    setServiceName(service.name)
    setServiceDescription(service.description || '')
    setServiceUrl(service.url || '')
    setServiceNotes(service.notes || '')
    setServiceLinkedAccountId(service.linked_account_id || '')
    setServiceDialogOpen(true)
  }

  const saveService = async () => {
    const name = serviceName.trim()
    if (!name) return

    await window.electronAPI.updateSecretService(service.id, {
      name,
      description: serviceDescription.trim(),
      url: serviceUrl.trim(),
      notes: serviceNotes.trim(),
      linkedAccountId: serviceLinkedAccountId || null,
    })
    setServiceDialogOpen(false)
    await loadServiceInfo()
    await refreshDetail()
  }

  const openCreateFieldDialog = () => {
    setEditingField(null)
    setFieldName('')
    setFieldValue('')
    setFieldIsSecret(true)
    setFieldValueVisible(false)
    setFieldDialogOpen(true)
  }

  const openEditFieldDialog = (field: SecretFieldRow) => {
    setEditingField(field)
    setFieldName(field.field_name)
    setFieldValue(field.field_value)
    setFieldIsSecret(Boolean(field.is_secret))
    setFieldValueVisible(false)
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

  const deleteField = (field: SecretFieldRow) => {
    setDeleteTarget({ kind: 'field', id: field.id, name: field.field_name })
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

  const deleteGroup = (group: SecretFieldGroupRow) => {
    setDeleteTarget({ kind: 'field-group', id: group.id, name: group.name })
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

  const deleteService = () => {
    setDeleteTarget({ kind: 'service', id: service.id, name: service.name })
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)

    try {
      if (deleteTarget.kind === 'field') {
        await window.electronAPI.deleteSecretField(deleteTarget.id)
        await refreshDetail()
      } else if (deleteTarget.kind === 'field-group') {
        await window.electronAPI.deleteSecretFieldGroup(deleteTarget.id)
        await refreshDetail()
      } else {
        await window.electronAPI.deleteSecretService(deleteTarget.id)
        setSelectedService(null)
        await loadServiceInfo()
      }
      setDeleteTarget(null)
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `删除失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setDeleteBusy(false)
    }
  }

  const dropBeforeField = async (targetFieldId: string, droppedFieldId: string) => {
    const target = fields.find((field) => field.id === targetFieldId)
    if (!target) return

    const movingIds = selectedFieldIds.includes(droppedFieldId)
      ? selectedFieldIds
      : [droppedFieldId]
    const targetGroupIds = fields
      .filter((field) => field.group_id === target.group_id && !movingIds.includes(field.id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field) => field.id)
    const orderedIds = moveIdsBefore(
      [...targetGroupIds, ...movingIds.filter((id) => !targetGroupIds.includes(id))],
      movingIds,
      targetFieldId
    )

    await window.electronAPI.reorderSecretFields({ orderedIds, groupId: target.group_id })
    setDraggingFieldId(null)
    clearSelectedFieldIds()
    await refreshDetail()
  }

  const toggleFavorite = async () => {
    await window.electronAPI.updateSecretService(service.id, {
      isFavorite: service.is_favorite ? 0 : 1,
    })
    await loadServiceInfo()
    await refreshDetail()
  }

  const openServiceUrl = async () => {
    try {
      const result = await window.electronAPI.openExternal(service.url)
      if (!result.success) {
        setNotice({ severity: 'error', text: result.error || '无法打开该网址' })
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `无法打开该网址：${error instanceof Error ? error.message : String(error)}`,
      })
    }
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
                <Button
                  size="small"
                  endIcon={<OpenInNewIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => void openServiceUrl()}
                  sx={{ mt: 0.5, px: 0, minWidth: 0, textTransform: 'none', justifyContent: 'flex-start' }}
                >
                  <Typography component="span" variant="caption" noWrap>{service.url}</Typography>
                </Button>
              )}
              {linkedAccount && (
                <Button
                  size="small"
                  startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: '15px !important' }} />}
                  onClick={() => navigateToAccount(linkedAccount.id)}
                  sx={{ display: 'flex', mt: 0.25, px: 0, minWidth: 0, justifyContent: 'flex-start' }}
                >
                  关联账号：{linkedAccount.name}
                </Button>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, WebkitAppRegion: 'no-drag', position: 'relative', zIndex: 2 }}>
            <Tooltip title={service.is_favorite ? '取消收藏' : '收藏'}>
              <IconButton size="small" onClick={toggleFavorite}>
                {service.is_favorite
                  ? <StarIcon fontSize="small" sx={{ color: '#fdd663' }} />
                  : <StarBorderIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="编辑服务">
              <IconButton size="small" onClick={openEditServiceDialog}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
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
          onDragEnd={() => setDraggingFieldId(null)}
          onDropBefore={dropBeforeField}
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
              onDragEnd={() => setDraggingFieldId(null)}
              onDropBefore={dropBeforeField}
            />
          ))}
        {service.notes && (
          <Box sx={{ px: 2, py: 1.6, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 800, mb: 0.5 }}>备注</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.65 }}>{service.notes}</Typography>
          </Box>
        )}
      </Box>

      <Dialog open={serviceDialogOpen} onClose={() => setServiceDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditOutlinedIcon sx={{ color: 'primary.main' }} />
          编辑服务
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="服务名称"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
          />
          <TextField
            fullWidth
            label="用途"
            value={serviceDescription}
            onChange={(event) => setServiceDescription(event.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="网址"
            placeholder="https://example.com"
            value={serviceUrl}
            onChange={(event) => setServiceUrl(event.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            select
            fullWidth
            label="关联主账号"
            value={serviceLinkedAccountId}
            onChange={(event) => setServiceLinkedAccountId(event.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="">不关联账号</MenuItem>
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>{account.name} · {account.username || '未设置登录账号'}</MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="备注"
            value={serviceNotes}
            onChange={(event) => setServiceNotes(event.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setServiceDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={saveService} disabled={!serviceName.trim()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={fieldDialogOpen} onClose={() => setFieldDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingField ? '编辑字段' : '新建字段'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="字段名称"
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
          />
          <TextField
            fullWidth
            type={fieldIsSecret && !fieldValueVisible ? 'password' : 'text'}
            multiline={!fieldIsSecret}
            minRows={fieldIsSecret ? undefined : 3}
            label="字段值"
            value={fieldValue}
            onChange={(event) => setFieldValue(event.target.value)}
            InputProps={{
              endAdornment: fieldIsSecret ? (
                <InputAdornment position="end">
                  <Tooltip title={fieldValueVisible ? '隐藏敏感值' : '显示敏感值'}>
                    <IconButton size="small" onClick={() => setFieldValueVisible((current) => !current)} edge="end">
                      {fieldValueVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : undefined,
            }}
            sx={{ mt: 2 }}
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox checked={fieldIsSecret} onChange={(event) => {
              setFieldIsSecret(event.target.checked)
              if (event.target.checked) setFieldValueVisible(false)
            }} />}
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
        <DialogContent>
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
        <DialogContent>
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

      <Dialog
        open={deleteTarget !== null}
        onClose={() => { if (!deleteBusy) setDeleteTarget(null) }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          {deleteTarget?.kind === 'service'
            ? '确认删除服务'
            : deleteTarget?.kind === 'field-group'
              ? '确认删除字段组'
              : '确认删除字段'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定删除“{deleteTarget?.name}”吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', fontSize: '0.82rem' }}>
            {deleteTarget?.kind === 'service'
              ? '服务会进入回收站，可在回收站中恢复。'
              : deleteTarget?.kind === 'field-group'
                ? '字段组会被删除，组内字段将移动到未分组。'
                : '字段删除后无法从回收站恢复。'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={deleteBusy}>
            {deleteBusy ? '删除中…' : deleteTarget?.kind === 'service' ? '移入回收站' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={notice !== null} autoHideDuration={5000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.severity || 'error'} variant="filled" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}
