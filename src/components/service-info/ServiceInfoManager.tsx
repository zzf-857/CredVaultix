import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
import ClearIcon from '@mui/icons-material/Clear'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../stores/useStore'
import type { SecretGroupRow, SecretServiceRow, ServiceInfoSortMode } from '../../types'
import { getGroupedItems, moveIdsBefore, sortServiceInfoItems } from '../../utils/serviceInfoGrouping'
import EmptyState from '../common/EmptyState'
import PageHeader from '../common/PageHeader'
import BatchActionBar from './BatchActionBar'
import ServiceFormDialog from './ServiceFormDialog'
import ServiceGroupList from './ServiceGroupList'
import ServiceDetail from './ServiceDetail'
import {
  buildServiceFormSubmission,
  buildServicePresetFields,
  createEmptyServiceFormValues,
  type ServiceFormValues,
} from './serviceForm'

const GROUP_COLORS = ['#7d98d5', '#70a6b5', '#d09a61', '#64b58a', '#9c8ccf', '#8a90a0']

const sortOptions: { value: ServiceInfoSortMode; label: string }[] = [
  { value: 'manual', label: '手动排序' },
  { value: 'favorites-first', label: '收藏优先' },
  { value: 'name-asc', label: '名称 A-Z' },
  { value: 'name-desc', label: '名称 Z-A' },
  { value: 'updated-desc', label: '最近更新' },
  { value: 'updated-asc', label: '最早更新' },
  { value: 'random', label: '随机排序' },
]

type Notice = {
  severity: 'error' | 'warning'
  text: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function assertMutationSucceeded(result: { success: boolean }, failureMessage: string) {
  if (!result.success) {
    throw new Error(failureMessage)
  }
}

function serviceMatches(service: SecretServiceRow, query: string) {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true
  return [service.name, service.description, service.url, service.notes]
    .join(' ')
    .toLowerCase()
    .includes(keyword)
}

export default function ServiceInfoManager() {
  const {
    allAccounts: accounts,
    clearSelectedServiceIds,
    loadAllAccounts,
    loadServiceInfo,
    secretServices,
    selectedServiceId,
    selectedServiceIds,
    serviceGroups,
    serviceSearchQuery,
    serviceSortMode,
    setSelectedService,
    setServiceSearchQuery,
    setServiceSortMode,
    toggleSelectedServiceId,
  } = useStore()

  const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null)
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SecretGroupRow | null>(null)
  const [serviceForm, setServiceForm] = useState<ServiceFormValues>(() => createEmptyServiceFormValues())
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [groupToDelete, setGroupToDelete] = useState<SecretGroupRow | null>(null)
  const [pendingServiceGroup, setPendingServiceGroup] = useState<{ id: string; name: string } | null>(null)
  const [mutationBusy, setMutationBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [listLoadState, setListLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listLoadError, setListLoadError] = useState('')
  const mutationLockRef = useRef(false)

  const loadInitialServiceInfo = async () => {
    setListLoadState('loading')
    setListLoadError('')
    try {
      await loadServiceInfo()
      setListLoadState('ready')
    } catch (error) {
      setListLoadError(`读取服务信息失败：${errorMessage(error)}`)
      setListLoadState('error')
    }
  }

  useEffect(() => {
    void loadInitialServiceInfo()
  }, [loadServiceInfo])

  useEffect(() => {
    if (accounts.length === 0) {
      void loadAllAccounts().catch((error) => {
        setNotice({ severity: 'error', text: `账号列表加载失败：${errorMessage(error)}` })
      })
    }
  }, [accounts.length, loadAllAccounts])

  const visibleServices = useMemo(() => {
    return sortServiceInfoItems(
      secretServices.filter((service) => serviceMatches(service, serviceSearchQuery)),
      serviceSortMode
    )
  }, [secretServices, serviceSearchQuery, serviceSortMode])

  const groupedServices = useMemo(() => getGroupedItems(visibleServices), [visibleServices])
  const orderedGroups = useMemo(
    () => [...serviceGroups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-Hans-CN')),
    [serviceGroups]
  )

  const beginMutation = () => {
    if (mutationLockRef.current) return false
    mutationLockRef.current = true
    setMutationBusy(true)
    setNotice(null)
    return true
  }

  const finishMutation = () => {
    mutationLockRef.current = false
    setMutationBusy(false)
  }

  const reportMutationFailure = (action: string, error: unknown) => {
    setNotice({ severity: 'error', text: `${action}失败：${errorMessage(error)}` })
  }

  const reloadAfterSuccessfulChange = async (completedAction: string) => {
    try {
      await loadServiceInfo()
      setListLoadState('ready')
      setListLoadError('')
      return true
    } catch (error) {
      setNotice({
        severity: 'warning',
        text: `${completedAction}，但列表刷新失败：${errorMessage(error)}。请稍后重新进入此页面确认最新状态。`,
      })
      return false
    }
  }

  const reportPartialFailure = async (completedAction: string, failedAction: string, error: unknown) => {
    let refreshFailure = ''
    try {
      await loadServiceInfo()
      setListLoadState('ready')
      setListLoadError('')
    } catch (refreshError) {
      refreshFailure = `；列表刷新也失败：${errorMessage(refreshError)}`
    }

    setNotice({
      severity: 'error',
      text: `${completedAction}，但${failedAction}：${errorMessage(error)}${refreshFailure}`,
    })
  }

  const openCreateServiceDialog = () => {
    if (mutationLockRef.current) return
    setServiceForm(createEmptyServiceFormValues())
    setPendingServiceGroup(null)
    setServiceDialogOpen(true)
  }

  const closeServiceDialog = () => {
    if (mutationLockRef.current) return
    setServiceDialogOpen(false)
    setPendingServiceGroup(null)
  }

  const findGroupByName = (name: string) => {
    const normalized = name.trim().toLowerCase()
    return orderedGroups.find((group) => group.name.trim().toLowerCase() === normalized)
  }

  const createService = async () => {
    const name = serviceForm.name.trim()
    if (!name || !beginMutation()) return

    let createdGroup: { id: string; name: string } | null = null
    try {
      const trimmedGroupName = serviceForm.groupName.trim()
      const existingGroup = trimmedGroupName ? findGroupByName(trimmedGroupName) : undefined
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

      const result = await window.electronAPI.createSecretService({
        id: uuidv4(),
        ...buildServiceFormSubmission(serviceForm, groupId),
      })
      if (!result?.id) throw new Error('新服务未返回有效结果')

      let presetError: unknown = null
      for (const presetField of buildServicePresetFields(serviceForm)) {
        try {
          const fieldResult = await window.electronAPI.createSecretField({
            id: uuidv4(),
            serviceId: result.id,
            fieldName: presetField.fieldName,
            fieldValue: presetField.fieldValue,
            isSecret: presetField.isSecret,
          })
          if (!fieldResult?.id) throw new Error(`${presetField.fieldName} 未返回有效结果`)
        } catch (error) {
          presetError = error
          break
        }
      }

      setServiceDialogOpen(false)
      setServiceForm(createEmptyServiceFormValues())
      setPendingServiceGroup(null)
      const refreshed = await reloadAfterSuccessfulChange('服务已创建')
      setSelectedService(result.id)

      if (presetError) {
        setNotice({
          severity: 'error',
          text: `服务已创建，但预设字段保存失败：${errorMessage(presetError)}${refreshed ? '' : '；列表刷新也失败'}`,
        })
      }
    } catch (error) {
      if (createdGroup) {
        await reportPartialFailure(
          `分组“${createdGroup.name}”已创建`,
          '服务创建失败，可直接重试且不会重复创建该分组',
          error
        )
      } else {
        reportMutationFailure('创建服务', error)
      }
    } finally {
      finishMutation()
    }
  }

  const openCreateGroupDialog = () => {
    if (mutationLockRef.current) return
    setEditingGroup(null)
    setGroupName('')
    setGroupColor(GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const closeGroupDialog = () => {
    if (mutationLockRef.current) return
    setGroupDialogOpen(false)
    setEditingGroup(null)
  }

  const openRenameGroupDialog = (group: SecretGroupRow) => {
    if (mutationLockRef.current) return
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupColor(group.color || GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const saveGroup = async () => {
    const name = groupName.trim()
    if (!name || !beginMutation()) return

    const selectedIds = [...selectedServiceIds]
    try {
      if (editingGroup) {
        const result = await window.electronAPI.updateSecretGroup(editingGroup.id, { name, color: groupColor })
        assertMutationSucceeded(result, '分组不存在或未能更新')
        setGroupDialogOpen(false)
        setEditingGroup(null)
        await reloadAfterSuccessfulChange('分组已保存')
        return
      }

      const result = await window.electronAPI.createSecretGroup({ id: uuidv4(), name, color: groupColor })
      if (!result?.id) throw new Error('新分组未返回有效结果')
      setGroupDialogOpen(false)
      setEditingGroup(null)

      if (selectedIds.length > 0) {
        try {
          const moveResult = await window.electronAPI.moveSecretServices({ ids: selectedIds, groupId: result.id })
          assertMutationSucceeded(moveResult, '所选服务未能移动')
          clearSelectedServiceIds()
        } catch (error) {
          await reportPartialFailure('分组已创建', '所选服务移动失败', error)
          return
        }
      }

      await reloadAfterSuccessfulChange('分组已创建')
    } catch (error) {
      reportMutationFailure(editingGroup ? '保存分组' : '创建分组', error)
    } finally {
      finishMutation()
    }
  }

  const deleteGroup = (group: SecretGroupRow) => {
    if (mutationLockRef.current) return
    setGroupToDelete(group)
  }

  const confirmDeleteGroup = async () => {
    if (!groupToDelete || deleteBusy || !beginMutation()) return
    setDeleteBusy(true)
    try {
      const result = await window.electronAPI.deleteSecretGroup(groupToDelete.id)
      assertMutationSucceeded(result, '分组不存在或未能删除')
      setGroupToDelete(null)
      await reloadAfterSuccessfulChange('分组已删除')
    } catch (error) {
      reportMutationFailure('删除分组', error)
    } finally {
      setDeleteBusy(false)
      finishMutation()
    }
  }

  const toggleGroupCollapsed = async (group: SecretGroupRow) => {
    if (!beginMutation()) return
    try {
      const result = await window.electronAPI.updateSecretGroup(group.id, { isCollapsed: group.is_collapsed ? 0 : 1 })
      assertMutationSucceeded(result, '分组不存在或未能更新')
      await reloadAfterSuccessfulChange('分组状态已更新')
    } catch (error) {
      reportMutationFailure('更新分组状态', error)
    } finally {
      finishMutation()
    }
  }

  const moveSelectedToExistingGroup = async () => {
    const ids = [...selectedServiceIds]
    if (ids.length === 0 || !targetGroupId || !beginMutation()) return
    try {
      const result = await window.electronAPI.moveSecretServices({ ids, groupId: targetGroupId })
      assertMutationSucceeded(result, '所选服务未能移动')
      setMoveDialogOpen(false)
      setTargetGroupId('')
      clearSelectedServiceIds()
      await reloadAfterSuccessfulChange('所选服务已移动')
    } catch (error) {
      reportMutationFailure('移动服务', error)
    } finally {
      finishMutation()
    }
  }

  const ungroupSelected = async () => {
    const ids = [...selectedServiceIds]
    if (ids.length === 0 || !beginMutation()) return
    try {
      const result = await window.electronAPI.moveSecretServices({ ids, groupId: null })
      assertMutationSucceeded(result, '所选服务未能移出分组')
      clearSelectedServiceIds()
      await reloadAfterSuccessfulChange('所选服务已移出分组')
    } catch (error) {
      reportMutationFailure('移出分组', error)
    } finally {
      finishMutation()
    }
  }

  const dropToGroup = async (groupId: string | null, serviceId: string) => {
    const ids = selectedServiceIds.includes(serviceId) ? selectedServiceIds : [serviceId]
    setDraggingServiceId(null)
    if (!beginMutation()) return
    try {
      const result = await window.electronAPI.moveSecretServices({ ids: [...ids], groupId })
      assertMutationSucceeded(result, '拖放的服务未能移动')
      await reloadAfterSuccessfulChange('服务已移动')
    } catch (error) {
      reportMutationFailure('移动服务', error)
    } finally {
      finishMutation()
    }
  }

  const dropBeforeService = async (targetServiceId: string, droppedServiceId: string) => {
    const target = secretServices.find((service) => service.id === targetServiceId)
    setDraggingServiceId(null)
    if (!target || !beginMutation()) return

    const movingIds = selectedServiceIds.includes(droppedServiceId)
      ? selectedServiceIds
      : [droppedServiceId]
    const targetGroupIds = secretServices
      .filter((service) => service.group_id === target.group_id && !movingIds.includes(service.id))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((service) => service.id)
    const orderedIds = moveIdsBefore(
      [...targetGroupIds, ...movingIds.filter((id) => !targetGroupIds.includes(id))],
      movingIds,
      targetServiceId
    )

    try {
      const result = await window.electronAPI.reorderSecretServices({ orderedIds, groupId: target.group_id })
      assertMutationSucceeded(result, '服务顺序未能保存')
      clearSelectedServiceIds()
      await reloadAfterSuccessfulChange('服务顺序已保存')
    } catch (error) {
      reportMutationFailure('调整服务顺序', error)
    } finally {
      finishMutation()
    }
  }

  const toggleFavorite = async (service: SecretServiceRow) => {
    if (!beginMutation()) return
    try {
      const result = await window.electronAPI.updateSecretService(service.id, { isFavorite: service.is_favorite ? 0 : 1 })
      assertMutationSucceeded(result, '服务不存在或未能更新')
      await reloadAfterSuccessfulChange('收藏状态已更新')
    } catch (error) {
      reportMutationFailure('更新收藏状态', error)
    } finally {
      finishMutation()
    }
  }

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box
        sx={{
          flex: '0 1 320px',
          width: 320,
          minWidth: 280,
          maxWidth: 328,
          borderRight: '1px solid',
          borderColor: 'border.subtle',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <PageHeader
          compact
          title="服务信息"
          description={`${secretServices.length} 项记录`}
          actions={
            <>
              <Tooltip title="新建分组">
                <IconButton
                  size="small"
                  onClick={openCreateGroupDialog}
                  disabled={mutationBusy}
                  aria-label="新建服务分组"
                  sx={{ border: '1px solid', borderColor: 'border.subtle', bgcolor: 'surface.raised' }}
                >
                  <CreateNewFolderIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateServiceDialog}
                disabled={mutationBusy}
                aria-label="新建服务"
              >
                新建服务
              </Button>
            </>
          }
        />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(108px, 0.72fr)',
            gap: 0.75,
            px: 1.25,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
            bgcolor: 'background.paper',
          }}
        >
          <TextField
            size="small"
            fullWidth
            value={serviceSearchQuery}
            onChange={(event) => setServiceSearchQuery(event.target.value)}
            placeholder="搜索服务"
            inputProps={{ 'aria-label': '搜索服务或用途' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: serviceSearchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setServiceSearchQuery('')} aria-label="清空服务搜索">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <FormControl size="small" fullWidth>
            <Select
              value={serviceSortMode}
              onChange={(event) => setServiceSortMode(event.target.value as ServiceInfoSortMode)}
              inputProps={{ 'aria-label': '服务排序方式' }}
              startAdornment={<SortIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />}
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <BatchActionBar
          count={selectedServiceIds.length}
          onClear={clearSelectedServiceIds}
          onCreateGroup={openCreateGroupDialog}
          onMoveToGroup={() => { if (!mutationLockRef.current) setMoveDialogOpen(true) }}
          onUngroup={ungroupSelected}
        />

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', bgcolor: 'surface.sunken' }}>
          {listLoadState === 'loading' ? (
            <LinearProgress aria-label="正在读取服务信息" sx={{ mx: 2, mt: 1 }} />
          ) : listLoadState === 'error' ? (
            <Alert
              severity="error"
              sx={{ mx: 2, mt: 1 }}
              action={<Button color="inherit" size="small" onClick={() => { void loadInitialServiceInfo() }}>重试</Button>}
            >
              {listLoadError}
            </Alert>
          ) : visibleServices.length === 0 ? (
            <EmptyState
              compact
              icon={<VpnKeyOutlinedIcon fontSize="small" />}
              title="暂无符合条件的服务"
              description={serviceSearchQuery ? '没有匹配当前搜索的记录' : undefined}
            />
          ) : (
            <>
              <ServiceGroupList
                title="未分组"
                services={groupedServices.ungrouped}
                selectedServiceId={selectedServiceId}
                selectedServiceIds={selectedServiceIds}
                canDrag={serviceSortMode === 'manual' && !mutationBusy}
                draggingServiceId={draggingServiceId}
                onSelectService={setSelectedService}
                onToggleServiceSelected={toggleSelectedServiceId}
                onToggleFavorite={toggleFavorite}
                onDropToGroup={dropToGroup}
                onDragStart={setDraggingServiceId}
                onDragEnd={() => setDraggingServiceId(null)}
                onDropBefore={dropBeforeService}
              />
              {orderedGroups.map((group) => (
                <ServiceGroupList
                  key={group.id}
                  title={group.name}
                  color={group.color}
                  group={group}
                  services={groupedServices.groups[group.id] || []}
                  selectedServiceId={selectedServiceId}
                  selectedServiceIds={selectedServiceIds}
                  canDrag={serviceSortMode === 'manual' && !mutationBusy}
                  draggingServiceId={draggingServiceId}
                  onSelectService={setSelectedService}
                  onToggleServiceSelected={toggleSelectedServiceId}
                  onToggleFavorite={toggleFavorite}
                  onToggleCollapsed={toggleGroupCollapsed}
                  onRenameGroup={openRenameGroupDialog}
                  onDeleteGroup={deleteGroup}
                  onDropToGroup={dropToGroup}
                  onDragStart={setDraggingServiceId}
                  onDragEnd={() => setDraggingServiceId(null)}
                  onDropBefore={dropBeforeService}
                />
              ))}
            </>
          )}
        </Box>
      </Box>

      <ServiceDetail />

      <ServiceFormDialog
        open={serviceDialogOpen}
        mode="create"
        values={serviceForm}
        groups={orderedGroups}
        accounts={accounts}
        busy={mutationBusy}
        onChange={(patch) => setServiceForm((current) => ({ ...current, ...patch }))}
        onClose={closeServiceDialog}
        onSubmit={() => { void createService() }}
      />

      <Dialog
        open={groupDialogOpen}
        onClose={closeGroupDialog}
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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CreateNewFolderIcon sx={{ color: 'primary.main' }} />
          {editingGroup ? '重命名分组' : '新建分组'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="分组名称"
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
          <Button type="button" onClick={closeGroupDialog} disabled={mutationBusy}>取消</Button>
          <Button type="submit" variant="contained" disabled={!groupName.trim() || mutationBusy}>
            {mutationBusy ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveDialogOpen} onClose={() => { if (!mutationLockRef.current) setMoveDialogOpen(false) }} fullWidth maxWidth="xs">
        <DialogTitle>移入分组</DialogTitle>
        <DialogContent>
          <FormControl fullWidth>
            <InputLabel id="service-info-move-label">目标分组</InputLabel>
            <Select
              labelId="service-info-move-label"
              label="目标分组"
              value={targetGroupId}
              onChange={(event) => setTargetGroupId(event.target.value)}
              disabled={mutationBusy}
            >
              {orderedGroups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)} disabled={mutationBusy}>取消</Button>
          <Button variant="contained" onClick={moveSelectedToExistingGroup} disabled={!targetGroupId || mutationBusy}>
            {mutationBusy ? '移动中…' : '移动'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={groupToDelete !== null}
        onClose={() => { if (!mutationLockRef.current) setGroupToDelete(null) }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          确认删除分组
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">确定删除分组“{groupToDelete?.name}”吗？</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', fontSize: '0.82rem' }}>
            分组内服务不会被删除，而是移动到未分组。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupToDelete(null)} disabled={deleteBusy}>取消</Button>
          <Button variant="contained" color="error" onClick={confirmDeleteGroup} disabled={deleteBusy}>
            {deleteBusy ? '删除中…' : '确认删除'}
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
