import React, { useEffect, useMemo, useState } from 'react'
import {
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
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../../stores/useStore'
import type { SecretGroupRow, SecretServiceRow, ServiceInfoSortMode } from '../../types'
import { getGroupedItems, sortServiceInfoItems } from '../../utils/serviceInfoGrouping'
import BatchActionBar from './BatchActionBar'
import ServiceGroupList from './ServiceGroupList'
import ServiceDetail from './ServiceDetail'

const GROUP_COLORS = ['#a8c7fa', '#78d9ec', '#f6c177', '#b8e986', '#f4a6a6', '#c4b5fd']

const sortOptions: { value: ServiceInfoSortMode; label: string }[] = [
  { value: 'manual', label: '手动排序' },
  { value: 'favorites-first', label: '收藏优先' },
  { value: 'name-asc', label: '名称 A-Z' },
  { value: 'name-desc', label: '名称 Z-A' },
  { value: 'updated-desc', label: '最近更新' },
  { value: 'updated-asc', label: '最早更新' },
  { value: 'random', label: '随机排序' },
]

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
    clearSelectedServiceIds,
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
  const [serviceName, setServiceName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0])
  const [targetGroupId, setTargetGroupId] = useState<string>('')

  useEffect(() => {
    void loadServiceInfo()
  }, [loadServiceInfo])

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

  const reloadAfterChange = async () => {
    await loadServiceInfo()
  }

  const createService = async () => {
    const name = serviceName.trim()
    if (!name) return

    const result = await window.electronAPI.createSecretService({
      id: uuidv4(),
      name,
      description: serviceDescription.trim(),
    })
    setServiceDialogOpen(false)
    setServiceName('')
    setServiceDescription('')
    await reloadAfterChange()
    setSelectedService(result.id)
  }

  const openCreateGroupDialog = () => {
    setEditingGroup(null)
    setGroupName('')
    setGroupColor(GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const openRenameGroupDialog = (group: SecretGroupRow) => {
    setEditingGroup(group)
    setGroupName(group.name)
    setGroupColor(group.color || GROUP_COLORS[0])
    setGroupDialogOpen(true)
  }

  const saveGroup = async () => {
    const name = groupName.trim()
    if (!name) return

    if (editingGroup) {
      await window.electronAPI.updateSecretGroup(editingGroup.id, { name, color: groupColor })
    } else {
      const result = await window.electronAPI.createSecretGroup({ id: uuidv4(), name, color: groupColor })
      if (selectedServiceIds.length > 0) {
        await window.electronAPI.moveSecretServices({ ids: selectedServiceIds, groupId: result.id })
        clearSelectedServiceIds()
      }
    }

    setGroupDialogOpen(false)
    setEditingGroup(null)
    await reloadAfterChange()
  }

  const deleteGroup = async (group: SecretGroupRow) => {
    const confirmed = window.confirm(`删除分组“${group.name}”？分组内服务会移到未分组。`)
    if (!confirmed) return
    await window.electronAPI.deleteSecretGroup(group.id)
    await reloadAfterChange()
  }

  const toggleGroupCollapsed = async (group: SecretGroupRow) => {
    await window.electronAPI.updateSecretGroup(group.id, { isCollapsed: group.is_collapsed ? 0 : 1 })
    await reloadAfterChange()
  }

  const moveSelectedToExistingGroup = async () => {
    const ids = selectedServiceIds
    if (ids.length === 0 || !targetGroupId) return
    await window.electronAPI.moveSecretServices({ ids, groupId: targetGroupId })
    setMoveDialogOpen(false)
    setTargetGroupId('')
    clearSelectedServiceIds()
    await reloadAfterChange()
  }

  const ungroupSelected = async () => {
    if (selectedServiceIds.length === 0) return
    await window.electronAPI.moveSecretServices({ ids: selectedServiceIds, groupId: null })
    clearSelectedServiceIds()
    await reloadAfterChange()
  }

  const dropToGroup = async (groupId: string | null, serviceId: string) => {
    const ids = selectedServiceIds.includes(serviceId) ? selectedServiceIds : [serviceId]
    await window.electronAPI.moveSecretServices({ ids, groupId })
    setDraggingServiceId(null)
    await reloadAfterChange()
  }

  const toggleFavorite = async (service: SecretServiceRow) => {
    await window.electronAPI.updateSecretService(service.id, { isFavorite: service.is_favorite ? 0 : 1 })
    await reloadAfterChange()
  }

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ width: 380, minWidth: 320, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                服务信息
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {secretServices.length} 项记录
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Tooltip title="新建分组">
                <IconButton size="small" onClick={openCreateGroupDialog}>
                  <CreateNewFolderIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setServiceDialogOpen(true)}>
                新建服务
              </Button>
            </Box>
          </Box>

          <TextField
            size="small"
            fullWidth
            value={serviceSearchQuery}
            onChange={(event) => setServiceSearchQuery(event.target.value)}
            placeholder="搜索服务或用途"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: serviceSearchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setServiceSearchQuery('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <FormControl size="small" fullWidth sx={{ mt: 1 }}>
            <InputLabel id="service-info-sort-label">排序</InputLabel>
            <Select
              labelId="service-info-sort-label"
              label="排序"
              value={serviceSortMode}
              onChange={(event) => setServiceSortMode(event.target.value as ServiceInfoSortMode)}
              startAdornment={<SortIcon sx={{ fontSize: 17, mr: 0.75, color: 'text.secondary' }} />}
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
          onMoveToGroup={() => setMoveDialogOpen(true)}
          onUngroup={ungroupSelected}
        />

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {visibleServices.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                暂无符合条件的内容
              </Typography>
            </Box>
          ) : (
            <>
              <ServiceGroupList
                title="未分组"
                services={groupedServices.ungrouped}
                selectedServiceId={selectedServiceId}
                selectedServiceIds={selectedServiceIds}
                draggingServiceId={draggingServiceId}
                onSelectService={setSelectedService}
                onToggleServiceSelected={toggleSelectedServiceId}
                onToggleFavorite={toggleFavorite}
                onDropToGroup={dropToGroup}
                onDragStart={setDraggingServiceId}
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
                  draggingServiceId={draggingServiceId}
                  onSelectService={setSelectedService}
                  onToggleServiceSelected={toggleSelectedServiceId}
                  onToggleFavorite={toggleFavorite}
                  onToggleCollapsed={toggleGroupCollapsed}
                  onRenameGroup={openRenameGroupDialog}
                  onDeleteGroup={deleteGroup}
                  onDropToGroup={dropToGroup}
                  onDragStart={setDraggingServiceId}
                />
              ))}
            </>
          )}
        </Box>
      </Box>

      <ServiceDetail />

      <Dialog open={serviceDialogOpen} onClose={() => setServiceDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>新建服务</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="服务名称"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            sx={{ mt: 1.5 }}
          />
          <TextField
            fullWidth
            label="用途"
            value={serviceDescription}
            onChange={(event) => setServiceDescription(event.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setServiceDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={createService} disabled={!serviceName.trim()}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingGroup ? '重命名分组' : '新建分组'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="分组名称"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            sx={{ mt: 1.5 }}
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
        <DialogTitle>移入分组</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <FormControl fullWidth sx={{ mt: 1.5 }}>
            <InputLabel id="service-info-move-label">目标分组</InputLabel>
            <Select
              labelId="service-info-move-label"
              label="目标分组"
              value={targetGroupId}
              onChange={(event) => setTargetGroupId(event.target.value)}
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
          <Button onClick={() => setMoveDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={moveSelectedToExistingGroup} disabled={!targetGroupId}>
            移动
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
