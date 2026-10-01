import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import SearchIcon from '@mui/icons-material/Search'
import { useStore } from '../stores/useStore'
import type { AccountTagUsageRow } from '../types'
import { TAG_COLOR_PALETTE } from '../utils/tagColors'
import PlatformIcon from './accounts/PlatformIcon'

const MAX_ACCOUNT_TAG_LENGTH = 64

export default function TagManagerDialog({
  open,
  focusTagId = null,
  onClose,
  onChanged,
}: {
  open: boolean
  focusTagId?: string | null
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const { deleteTag, updateTags } = useStore()
  const [tags, setTags] = useState<AccountTagUsageRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { name: string; color: string }>>({})
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AccountTagUsageRow | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const loadTags = async () => {
    try {
      const nextTags = await window.electronAPI.getAccountTags()
      setTags(nextTags)
      setDrafts(Object.fromEntries(nextTags.map((tag) => [tag.id, { name: tag.name, color: tag.color }])))
      setLoadError('')
    } catch (error) {
      setLoadError(`读取标签失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  useEffect(() => {
    if (!open) return
    setSearch('')
    setSaveError('')
    setDeleteTarget(null)
    void loadTags()
  }, [open])

  useEffect(() => {
    if (!open || !focusTagId) return
    const frame = window.requestAnimationFrame(() => {
      rowRefs.current[focusTagId]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, focusTagId, tags])

  const visibleTags = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return tags
    return tags.filter((tag) => tag.name.toLocaleLowerCase().includes(query) || drafts[tag.id]?.name.toLocaleLowerCase().includes(query))
  }, [drafts, search, tags])

  const dirtyPatches = tags.flatMap((tag) => {
    const draft = drafts[tag.id]
    if (!draft) return []
    const name = draft.name.trim()
    if (name === tag.name && draft.color === tag.color) return []
    return [{ id: tag.id, name, color: draft.color }]
  })

  const handleSave = async () => {
    if (busy || dirtyPatches.length === 0) return
    setBusy(true)
    setSaveError('')
    try {
      const result = await updateTags(dirtyPatches)
      await onChanged()
      await loadTags()
      if (result.refreshFailed) {
        setSaveError('标签已保存，但账号列表刷新失败')
      }
    } catch (error) {
      setSaveError(`保存标签失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || busy) return
    setBusy(true)
    setSaveError('')
    try {
      const result = await deleteTag(deleteTarget.id)
      if (!result.success) throw new Error('标签不存在或已经删除')
      setDeleteTarget(null)
      await onChanged()
      await loadTags()
      if (result.refreshFailed) {
        setSaveError(`标签“${deleteTarget.name}”已删除，但界面刷新失败`)
      }
    } catch (error) {
      setSaveError(`删除标签失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={() => { if (!busy) onClose() }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LabelOutlinedIcon sx={{ color: 'primary.main' }} />
          管理标签
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, lineHeight: 1.55 }}>
            在这里批量改名或改颜色。保存后，所有使用该标签的账号都会一起更新。
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="搜索标签..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            inputProps={{ 'aria-label': '搜索标签' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1.5 }}
          />
          {loadError && <Alert severity="error" sx={{ mb: 1.5 }}>{loadError}</Alert>}
          {saveError && <Alert severity="warning" sx={{ mb: 1.5 }}>{saveError}</Alert>}
          {visibleTags.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              {tags.length === 0 ? '还没有创建任何标签。' : '没有匹配的标签。'}
            </Typography>
          ) : (
            <Box sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
              {visibleTags.map((tag) => {
                const draft = drafts[tag.id] || { name: tag.name, color: tag.color }
                const focused = tag.id === focusTagId
                return (
                  <Box
                    key={tag.id}
                    ref={(node: HTMLDivElement | null) => { rowRefs.current[tag.id] = node }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 1,
                      px: 1,
                      mb: 0.75,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: focused ? 'primary.main' : 'border.subtle',
                      bgcolor: focused ? 'action.selected' : 'surface.raised',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', width: 92, flexShrink: 0 }}>
                      {TAG_COLOR_PALETTE.map((color) => (
                        <Box
                          key={color}
                          component="button"
                          type="button"
                          aria-label={`将 ${tag.name} 设为颜色 ${color}`}
                          aria-pressed={draft.color === color}
                          disabled={busy}
                          onClick={() => setDrafts((current) => ({
                            ...current,
                            [tag.id]: { ...draft, color },
                          }))}
                          sx={{
                            width: 16,
                            height: 16,
                            p: 0,
                            borderRadius: '50%',
                            border: '2px solid',
                            borderColor: draft.color === color ? 'text.primary' : 'transparent',
                            bgcolor: color,
                            cursor: busy ? 'default' : 'pointer',
                          }}
                        />
                      ))}
                    </Box>
                    <TextField
                      size="small"
                      fullWidth
                      value={draft.name}
                      disabled={busy}
                      inputProps={{ maxLength: MAX_ACCOUNT_TAG_LENGTH, 'aria-label': `编辑标签 ${tag.name}` }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PlatformIcon name={draft.name} size={18} />
                          </InputAdornment>
                        ),
                      }}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [tag.id]: { ...draft, name: event.target.value },
                      }))}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 42, textAlign: 'right' }}>
                      {tag.usage_count} 个
                    </Typography>
                    <Tooltip title="删除标签">
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`删除标签 ${tag.name}`}
                          disabled={busy}
                          onClick={() => setDeleteTarget(tag)}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                )
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={busy}>关闭</Button>
          <Button type="button" variant="contained" onClick={() => { void handleSave() }} disabled={busy || dirtyPatches.length === 0}>
            {busy ? '保存中...' : `保存 ${dirtyPatches.length} 项更改`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => { if (!busy) setDeleteTarget(null) }} maxWidth="xs" fullWidth>
        <DialogTitle>删除标签</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            确定要彻底删除标签 <strong>{deleteTarget?.name}</strong> 吗？
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.55 }}>
            将从 {deleteTarget?.usage_count ?? 0} 个关联账号中移除该标签。账号、密码、2FA 和其他字段都不会被删除；此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>取消</Button>
          <Button variant="contained" color="error" onClick={() => { void handleDelete() }} disabled={busy}>
            {busy ? '删除中...' : '删除标签'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
