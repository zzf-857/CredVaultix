import React, { useMemo, useRef, useState } from 'react'
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
  LinearProgress,
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
import EmptyState from '../common/EmptyState'
import SectionLabel from '../common/SectionLabel'
import BatchActionBar from './BatchActionBar'
import ServiceFormDialog from './ServiceFormDialog'
import ServiceFieldGroup from './ServiceFieldGroup'
import {
  buildServiceFormSubmission,
  buildServicePresetFields,
  createEmptyServiceFormValues,
  createServiceFormValues,
  findPresetField,
  servicePresetFieldsNeedSaving,
  type ServiceFormValues,
} from './serviceForm'

const GROUP_COLORS = ['#7d98d5', '#70a6b5', '#d09a61', '#64b58a', '#9c8ccf', '#8a90a0']

type DeleteTarget = {
  kind: 'field' | 'field-group' | 'service'
  id: string
  name: string
} | null

export default function ServiceDetail() {
  const {
    clearSelectedFieldIds,
    allAccounts: accounts,
    loadServiceDetail,
    loadServiceInfo,
    selectedFieldIds,
    selectedServiceId,
    selectedServiceDetail,
    serviceGroups,
    serviceDetailLoadError,
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
  const [serviceForm, setServiceForm] = useState<ServiceFormValues>(() => createEmptyServiceFormValues())
  const [pendingServiceGroup, setPendingServiceGroup] = useState<{ id: string; name: string } | null>(null)
  const [fieldName, setFieldName] = useState('')
  const [fieldValue, setFieldValue] = useState('')
  const [fieldIsSecret, setFieldIsSecret] = useState(true)
  const [fieldValueVisible, setFieldValueVisible] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [targetGroupId, setTargetGroupId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const mutationBusyRef = useRef(false)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)

  const fields = selectedServiceDetail?.fields || []
  const fieldGroups = selectedServiceDetail?.fieldGroups || []
  const groupedFields = useMemo(() => getGroupedItems(sortServiceInfoItems(fields, 'manual')), [fields])
  const orderedServiceGroups = useMemo(
    () => [...serviceGroups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-Hans-CN')),
    [serviceGroups]
  )

  if (!selectedServiceDetail) {
    if (selectedServiceId) {
      return (
        <Box sx={{ flex: 1, minWidth: 0, p: 3, bgcolor: 'background.default' }}>
          {serviceDetailLoadError ? (
            <Alert
              severity="error"
              action={<Button color="inherit" size="small" onClick={() => { void loadServiceDetail(selectedServiceId).catch(() => undefined) }}>重试</Button>}
            >
              {serviceDetailLoadError}
            </Alert>
          ) : (
            <LinearProgress aria-label="正在读取服务详情" />
          )}
        </Box>
      )
    }

    return (
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <EmptyState
          icon={<VpnKeyOutlinedIcon />}
          title="选择一个服务信息"
          description="服务字段与分组会显示在这里"
        />
      </Box>
    )
  }

  const { service } = selectedServiceDetail
  const linkedAccount = accounts.find((account) => account.id === service.linked_account_id)

  const beginMutation = () => {
    if (mutationBusyRef.current) return false
    mutationBusyRef.current = true
    setMutationBusy(true)
    return true
  }

  const endMutation = () => {
    mutationBusyRef.current = false
    setMutationBusy(false)
  }

  const assertMutationSucceeded = (result: { success: boolean }, message: string) => {
    if (!result.success) throw new Error(message)
  }

  const refreshServiceData = async (serviceId: string) => {
    const results = await Promise.allSettled([
      Promise.resolve().then(() => loadServiceInfo()),
      Promise.resolve().then(() => loadServiceDetail(serviceId)),
    ])
    return results.some((result) => result.status === 'rejected')
  }

  const reportCommittedMutation = (
    successText: string,
    refreshFailed: boolean,
    refreshFailureText = `${successText}但刷新失败`
  ) => {
    setNotice({
      severity: refreshFailed ? 'info' : 'success',
      text: refreshFailed ? refreshFailureText : successText,
    })
  }

  const openEditServiceDialog = () => {
    if (mutationBusyRef.current) return
    const currentGroupName = orderedServiceGroups.find((group) => group.id === service.group_id)?.name || ''
    setServiceForm(createServiceFormValues(service, currentGroupName, fields))
    setPendingServiceGroup(null)
    setServiceDialogOpen(true)
  }

  const closeServiceDialog = () => {
    if (mutationBusyRef.current) return
    setServiceDialogOpen(false)
    setPendingServiceGroup(null)
  }

  const findServiceGroupByName = (name: string) => {
    const normalized = name.trim().toLowerCase()
    return orderedServiceGroups.find((group) => group.name.trim().toLowerCase() === normalized)
  }

  const saveService = async () => {
    const name = serviceForm.name.trim()
    if (!name || !beginMutation()) return

    let createdGroup: { id: string; name: string } | null = null
    try {
      const trimmedGroupName = serviceForm.groupName.trim()
      const existingGroup = trimmedGroupName ? findServiceGroupByName(trimmedGroupName) : undefined
      const reusablePendingGroup = pendingServiceGroup
        && pendingServiceGroup.name.trim().toLowerCase() === trimmedGroupName.toLowerCase()
        ? pendingServiceGroup
        : null
      let groupId = existingGroup?.id || reusablePendingGroup?.id || null

      if (!groupId && trimmedGroupName) {
        const groupResult = await window.electronAPI.createSecretGroup({
          id: uuidv4(),
          name: trimmedGroupName,
          color: GROUP_COLORS[0],
        })
        if (!groupResult?.id) throw new Error('新分组未返回有效结果')
        createdGroup = { id: groupResult.id, name: trimmedGroupName }
        groupId = groupResult.id
        setPendingServiceGroup(createdGroup)
      }

      const result = await window.electronAPI.updateSecretService(service.id, {
        ...buildServiceFormSubmission(serviceForm, groupId),
      })
      assertMutationSucceeded(result, '服务不存在或已被删除')

      let presetError: unknown = null
      const presetFields = servicePresetFieldsNeedSaving(serviceForm, fields)
        ? buildServicePresetFields(serviceForm)
        : []
      for (const presetField of presetFields) {
        try {
          const existingField = findPresetField(fields, presetField.fieldName)
          if (existingField) {
            const fieldResult = await window.electronAPI.updateSecretField(existingField.id, {
              fieldName: presetField.fieldName,
              fieldValue: presetField.fieldValue,
              isSecret: presetField.isSecret,
            })
            assertMutationSucceeded(fieldResult, `${presetField.fieldName} 不存在或已被删除`)
          } else {
            const fieldResult = await window.electronAPI.createSecretField({
              id: uuidv4(),
              serviceId: service.id,
              fieldName: presetField.fieldName,
              fieldValue: presetField.fieldValue,
              isSecret: presetField.isSecret,
            })
            if (!fieldResult?.id) throw new Error(`${presetField.fieldName} 未返回有效结果`)
          }
        } catch (error) {
          presetError = error
          break
        }
      }

      setServiceDialogOpen(false)
      setPendingServiceGroup(null)
      const refreshFailed = await refreshServiceData(service.id)

      if (presetError) {
        setNotice({
          severity: 'error',
          text: `服务信息已保存，但预设字段保存失败：${presetError instanceof Error ? presetError.message : String(presetError)}${refreshFailed ? '；界面刷新也失败' : ''}`,
        })
      } else {
        reportCommittedMutation('服务信息已保存', refreshFailed, '服务信息已保存但刷新失败')
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: createdGroup
          ? `分组“${createdGroup.name}”已创建，但服务信息保存失败，可直接重试且不会重复创建该分组：${error instanceof Error ? error.message : String(error)}`
          : `服务信息保存失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
  }

  const openCreateFieldDialog = () => {
    if (mutationBusyRef.current) return
    setEditingField(null)
    setFieldName('')
    setFieldValue('')
    setFieldIsSecret(true)
    setFieldValueVisible(false)
    setFieldDialogOpen(true)
  }

  const openEditFieldDialog = (field: SecretFieldRow) => {
    if (mutationBusyRef.current) return
    setEditingField(field)
    setFieldName(field.field_name)
    setFieldValue(field.field_value)
    setFieldIsSecret(Boolean(field.is_secret))
    setFieldValueVisible(false)
    setFieldDialogOpen(true)
  }

  const saveField = async () => {
    const name = fieldName.trim()
    if (!name || !beginMutation()) return

    try {
      if (editingField) {
        const result = await window.electronAPI.updateSecretField(editingField.id, {
          fieldName: name,
          fieldValue,
          isSecret: fieldIsSecret,
        })
        assertMutationSucceeded(result, '字段不存在或已被删除')
      } else {
        await window.electronAPI.createSecretField({
          id: uuidv4(),
          serviceId: service.id,
          fieldName: name,
          fieldValue,
          isSecret: fieldIsSecret,
        })
      }

      const action = editingField ? '更新' : '创建'
      setFieldDialogOpen(false)
      setEditingField(null)
      const refreshFailed = await refreshServiceData(service.id)
      reportCommittedMutation(`字段已${action}`, refreshFailed, `字段已${action}但刷新失败`)
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `字段保存失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
  }

  const deleteField = (field: SecretFieldRow) => {
    if (mutationBusyRef.current) return
    setDeleteTarget({ kind: 'field', id: field.id, name: field.field_name })
  }

  const openCreateGroupDialog = () => {
    if (mutationBusyRef.current) return
    setEditingGroup(null)
    setGroupName('')
    setGroupColor(GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const openRenameGroupDialog = (group: SecretFieldGroupRow) => {
    if (mutationBusyRef.current) return
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupColor(group.color || GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const saveGroup = async () => {
    const name = groupName.trim()
    if (!name || !beginMutation()) return

    try {
      const selectedIds = [...selectedFieldIds]
      let moveError: unknown = null

      if (editingGroup) {
        const result = await window.electronAPI.updateSecretFieldGroup(editingGroup.id, { name, color: groupColor })
        assertMutationSucceeded(result, '字段组不存在或已被删除')
      } else {
        const newGroupId = uuidv4()
        await window.electronAPI.createSecretFieldGroup({
          id: newGroupId,
          serviceId: service.id,
          name,
          color: groupColor,
        })

        // The group is committed at this point. Close the dialog before any follow-up move or refresh.
        setGroupDialogOpen(false)
        setEditingGroup(null)

        if (selectedIds.length > 0) {
          try {
            const moveResult = await window.electronAPI.moveSecretFields({ ids: selectedIds, groupId: newGroupId })
            assertMutationSucceeded(moveResult, '所选字段已变化，请刷新后重试移动')
            clearSelectedFieldIds()
          } catch (error) {
            moveError = error
          }
        }
      }

      setGroupDialogOpen(false)
      setEditingGroup(null)
      const refreshFailed = await refreshServiceData(service.id)

      if (moveError) {
        setNotice({
          severity: 'error',
          text: `字段组已创建，但移动所选字段失败：${moveError instanceof Error ? moveError.message : String(moveError)}${refreshFailed ? '；界面刷新也失败' : ''}`,
        })
      } else {
        const action = editingGroup ? '更新' : '创建'
        reportCommittedMutation(`字段组已${action}`, refreshFailed, `字段组已${action}但刷新失败`)
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `字段组保存失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
  }

  const deleteGroup = (group: SecretFieldGroupRow) => {
    if (mutationBusyRef.current) return
    setDeleteTarget({ kind: 'field-group', id: group.id, name: group.name })
  }

  const toggleGroupCollapsed = async (group: SecretFieldGroupRow) => {
    if (!beginMutation()) return
    try {
      const result = await window.electronAPI.updateSecretFieldGroup(group.id, { isCollapsed: group.is_collapsed ? 0 : 1 })
      assertMutationSucceeded(result, '字段组不存在或已被删除')
      const refreshFailed = await refreshServiceData(service.id)
      if (refreshFailed) {
        setNotice({ severity: 'info', text: '字段组折叠状态已保存但刷新失败' })
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `字段组状态更新失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
  }

  const moveSelectedToExistingGroup = async () => {
    if (selectedFieldIds.length === 0 || !targetGroupId || !beginMutation()) return
    try {
      const result = await window.electronAPI.moveSecretFields({ ids: [...selectedFieldIds], groupId: targetGroupId })
      assertMutationSucceeded(result, '所选字段已变化，请刷新后重试')

      setMoveDialogOpen(false)
      setTargetGroupId('')
      clearSelectedFieldIds()
      const refreshFailed = await refreshServiceData(service.id)
      reportCommittedMutation('所选字段已移动', refreshFailed, '所选字段已移动但刷新失败')
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `字段移动失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
  }

  const ungroupSelected = async () => {
    if (selectedFieldIds.length === 0 || !beginMutation()) return
    try {
      const result = await window.electronAPI.moveSecretFields({ ids: [...selectedFieldIds], groupId: null })
      assertMutationSucceeded(result, '所选字段已变化，请刷新后重试')

      clearSelectedFieldIds()
      const refreshFailed = await refreshServiceData(service.id)
      reportCommittedMutation('所选字段已移出分组', refreshFailed, '所选字段已移出分组但刷新失败')
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `移出分组失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
  }

  const dropToGroup = async (groupId: string | null, fieldId: string) => {
    if (!beginMutation()) return
    const ids = selectedFieldIds.includes(fieldId) ? selectedFieldIds : [fieldId]
    try {
      const result = await window.electronAPI.moveSecretFields({ ids: [...ids], groupId })
      assertMutationSucceeded(result, '字段已变化，请刷新后重试')

      setDraggingFieldId(null)
      const refreshFailed = await refreshServiceData(service.id)
      if (refreshFailed) {
        setNotice({ severity: 'info', text: '字段位置已保存但刷新失败' })
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `字段移动失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setDraggingFieldId(null)
      endMutation()
    }
  }

  const deleteService = () => {
    if (mutationBusyRef.current) return
    setDeleteTarget({ kind: 'service', id: service.id, name: service.name })
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !beginMutation()) return
    const target = deleteTarget

    try {
      if (target.kind === 'field') {
        const result = await window.electronAPI.deleteSecretField(target.id)
        assertMutationSucceeded(result, '字段不存在或已经删除')
        setDeleteTarget(null)
        const refreshFailed = await refreshServiceData(service.id)
        reportCommittedMutation('字段已删除', refreshFailed, '字段已删除但刷新失败')
      } else if (target.kind === 'field-group') {
        const result = await window.electronAPI.deleteSecretFieldGroup(target.id)
        assertMutationSucceeded(result, '字段组不存在或已经删除')
        setDeleteTarget(null)
        const refreshFailed = await refreshServiceData(service.id)
        reportCommittedMutation('字段组已删除', refreshFailed, '字段组已删除但刷新失败')
      } else {
        const result = await window.electronAPI.deleteSecretService(target.id)
        assertMutationSucceeded(result, '服务不存在或已经移入回收站')
        setDeleteTarget(null)
        setSelectedService(null)
        const refreshResults = await Promise.allSettled([
          Promise.resolve().then(() => loadServiceInfo()),
        ])
        const refreshFailed = refreshResults.some((refreshResult) => refreshResult.status === 'rejected')
        reportCommittedMutation('服务已移入回收站', refreshFailed, '服务已移入回收站但刷新失败')
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `删除失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
  }

  const dropBeforeField = async (targetFieldId: string, droppedFieldId: string) => {
    if (!beginMutation()) return
    const target = fields.find((field) => field.id === targetFieldId)
    if (!target) {
      endMutation()
      return
    }

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

    try {
      const result = await window.electronAPI.reorderSecretFields({ orderedIds, groupId: target.group_id })
      assertMutationSucceeded(result, '字段顺序已变化，请刷新后重试')

      setDraggingFieldId(null)
      clearSelectedFieldIds()
      const refreshFailed = await refreshServiceData(service.id)
      if (refreshFailed) {
        setNotice({ severity: 'info', text: '字段顺序已保存但刷新失败' })
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `字段排序失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      setDraggingFieldId(null)
      endMutation()
    }
  }

  const toggleFavorite = async () => {
    if (!beginMutation()) return
    try {
      const result = await window.electronAPI.updateSecretService(service.id, {
        isFavorite: service.is_favorite ? 0 : 1,
      })
      assertMutationSucceeded(result, '服务不存在或已被删除')
      const refreshFailed = await refreshServiceData(service.id)
      if (refreshFailed) {
        setNotice({ severity: 'info', text: '收藏状态已保存但刷新失败' })
      }
    } catch (error) {
      setNotice({
        severity: 'error',
        text: `收藏状态更新失败：${error instanceof Error ? error.message : String(error)}`,
      })
    } finally {
      endMutation()
    }
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
    <Box aria-busy={mutationBusy} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'border.subtle', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', alignItems: 'start', gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'surface.raised',
              border: '1px solid',
              borderColor: 'border.subtle',
              color: 'primary.main',
              flexShrink: 0,
            }}
          >
            <VpnKeyOutlinedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ fontSize: '1.05rem' }}>
              {service.name}
            </Typography>
            <Tooltip title={service.description || ''} placement="bottom-start">
              <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', mt: 0.2 }}>
                {service.description || '未填写用途说明'}
              </Typography>
            </Tooltip>
            {(service.url || linkedAccount) && (
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.25, minWidth: 0 }}>
                {service.url && (
                  <Button
                    size="small"
                    endIcon={<OpenInNewIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={() => void openServiceUrl()}
                    aria-label={`打开网址 ${service.url}`}
                    sx={{ minHeight: 24, py: 0, px: 0.5, minWidth: 0, maxWidth: '100%', justifyContent: 'flex-start' }}
                  >
                    <Typography component="span" variant="caption" noWrap>{service.url}</Typography>
                  </Button>
                )}
                {linkedAccount && (
                  <Button
                    size="small"
                    startIcon={<AccountCircleOutlinedIcon sx={{ fontSize: '15px !important' }} />}
                    onClick={() => navigateToAccount(linkedAccount.id)}
                    aria-label={`打开关联账号 ${linkedAccount.name}`}
                    sx={{ minHeight: 24, py: 0, px: 0.5, minWidth: 0, maxWidth: '100%', justifyContent: 'flex-start' }}
                  >
                    <Typography component="span" variant="caption" noWrap>{linkedAccount.name}</Typography>
                  </Button>
                )}
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25, WebkitAppRegion: 'no-drag', position: 'relative', zIndex: 2 }}>
            <Tooltip title={service.is_favorite ? '取消收藏' : '收藏'}>
              <IconButton
                size="small"
                onClick={toggleFavorite}
                disabled={mutationBusy}
                aria-label={service.is_favorite ? '取消收藏服务' : '收藏服务'}
                sx={{ width: 30, height: 30 }}
              >
                {service.is_favorite
                  ? <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                  : <StarBorderIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="编辑服务">
              <IconButton size="small" onClick={openEditServiceDialog} disabled={mutationBusy} aria-label="编辑服务" sx={{ width: 30, height: 30 }}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除服务">
              <IconButton size="small" onClick={deleteService} disabled={mutationBusy} aria-label="删除服务" sx={{ width: 30, height: 30 }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'border.subtle', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', bgcolor: 'surface.raised' }}>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateFieldDialog}
            disabled={mutationBusy}
            aria-label="新建字段"
          >
            新建字段
          </Button>
          <Button
            size="small"
            startIcon={<CreateNewFolderIcon />}
            onClick={openCreateGroupDialog}
            disabled={mutationBusy}
            aria-label="新建字段组"
          >
            新建字段组
          </Button>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {fields.length} 个字段
        </Typography>
      </Box>

      <BatchActionBar
        count={selectedFieldIds.length}
        onClear={clearSelectedFieldIds}
        onCreateGroup={openCreateGroupDialog}
        onMoveToGroup={() => { if (!mutationBusyRef.current) setMoveDialogOpen(true) }}
        onUngroup={ungroupSelected}
      />

      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', p: 2, bgcolor: 'surface.sunken' }}>
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
          <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'border.subtle' }}>
            <SectionLabel>备注</SectionLabel>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.65 }}>{service.notes}</Typography>
          </Box>
        )}
      </Box>

      <ServiceFormDialog
        open={serviceDialogOpen}
        mode="edit"
        values={serviceForm}
        groups={orderedServiceGroups}
        accounts={accounts}
        busy={mutationBusy}
        onChange={(patch) => setServiceForm((current) => ({ ...current, ...patch }))}
        onClose={closeServiceDialog}
        onSubmit={() => { void saveService() }}
      />

      <Dialog
        open={fieldDialogOpen}
        onClose={() => { if (!mutationBusy) setFieldDialogOpen(false) }}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          component: 'form',
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!mutationBusy && fieldName.trim()) void saveField()
          },
        }}
      >
        <DialogTitle>{editingField ? '编辑字段' : '新建字段'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="字段名称"
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
            disabled={mutationBusy}
          />
          <TextField
            fullWidth
            type={fieldIsSecret && !fieldValueVisible ? 'password' : 'text'}
            multiline={!fieldIsSecret}
            minRows={fieldIsSecret ? undefined : 3}
            label="字段值"
            value={fieldValue}
            onChange={(event) => setFieldValue(event.target.value)}
            disabled={mutationBusy}
            InputProps={{
              endAdornment: fieldIsSecret ? (
                <InputAdornment position="end">
                  <Tooltip title={fieldValueVisible ? '隐藏敏感值' : '显示敏感值'}>
                    <IconButton
                      size="small"
                      onClick={() => setFieldValueVisible((current) => !current)}
                      edge="end"
                      disabled={mutationBusy}
                      aria-label={fieldValueVisible ? '隐藏敏感值' : '显示敏感值'}
                    >
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
            control={<Checkbox checked={fieldIsSecret} disabled={mutationBusy} onChange={(event) => {
              setFieldIsSecret(event.target.checked)
              if (event.target.checked) setFieldValueVisible(false)
            }} />}
            label="敏感字段"
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setFieldDialogOpen(false)} disabled={mutationBusy}>取消</Button>
          <Button type="submit" variant="contained" disabled={mutationBusy || !fieldName.trim()}>
            {mutationBusy ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={groupDialogOpen}
        onClose={() => { if (!mutationBusy) setGroupDialogOpen(false) }}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          component: 'form',
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!mutationBusy && groupName.trim()) void saveGroup()
          },
        }}
      >
        <DialogTitle>{editingGroup ? '重命名字段组' : '新建字段组'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="字段组名称"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            disabled={mutationBusy}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {GROUP_COLORS.map((color) => (
              <IconButton
                key={color}
                size="small"
                onClick={() => setGroupColor(color)}
                disabled={mutationBusy}
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
          <Button type="button" onClick={() => setGroupDialogOpen(false)} disabled={mutationBusy}>取消</Button>
          <Button type="submit" variant="contained" disabled={mutationBusy || !groupName.trim()}>
            {mutationBusy ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveDialogOpen} onClose={() => { if (!mutationBusy) setMoveDialogOpen(false) }} fullWidth maxWidth="xs">
        <DialogTitle>移入字段组</DialogTitle>
        <DialogContent>
          <FormControl fullWidth>
            <InputLabel id="service-field-move-label">目标字段组</InputLabel>
            <Select
              labelId="service-field-move-label"
              label="目标字段组"
              value={targetGroupId}
              onChange={(event) => setTargetGroupId(event.target.value)}
              disabled={mutationBusy}
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
          <Button onClick={() => setMoveDialogOpen(false)} disabled={mutationBusy}>取消</Button>
          <Button variant="contained" onClick={moveSelectedToExistingGroup} disabled={mutationBusy || !targetGroupId}>
            {mutationBusy ? '移动中…' : '移动'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => { if (!mutationBusy) setDeleteTarget(null) }}
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
          <Button onClick={() => setDeleteTarget(null)} disabled={mutationBusy}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} disabled={mutationBusy}>
            {mutationBusy ? '删除中…' : deleteTarget?.kind === 'service' ? '移入回收站' : '确认删除'}
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
