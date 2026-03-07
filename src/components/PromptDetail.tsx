import React, { useState, useEffect } from 'react'
import {
  Box, Typography, IconButton, TextField, Button,
  Chip, Menu, MenuItem, Tooltip, Fade, Divider,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import FolderIcon from '@mui/icons-material/FolderOutlined'
import LabelIcon from '@mui/icons-material/LabelOutlined'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import MDEditor from '@uiw/react-md-editor'
import { useStore } from '../stores/useStore'

export default function PromptDetail() {
  const {
    selectedPromptId, prompts, folders, tags, themeMode,
    updatePrompt, deletePrompt, setSelectedPrompt,
  } = useStore()

  const prompt = prompts.find(p => p.id === selectedPromptId)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [tagMenuAnchor, setTagMenuAnchor] = useState<HTMLElement | null>(null)
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (prompt) {
      setEditTitle(prompt.title)
      setEditContent(prompt.content)
      setIsEditing(false)
    }
  }, [prompt?.id])

  if (!prompt) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          opacity: 0.5,
        }}
      >
        <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          选择一个 Prompt 查看详情
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          或点击 + 创建新的 Prompt
        </Typography>
      </Box>
    )
  }

  const promptTagIds = prompt.tag_ids ? prompt.tag_ids.split(',') : []
  const promptTags = promptTagIds.map(tid => tags.find(t => t.id === tid)).filter(Boolean)
  const currentFolder = folders.find(f => f.id === prompt.folder_id)

  const handleSave = async () => {
    await updatePrompt(prompt.id, { title: editTitle, content: editContent })
    setIsEditing(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDelete = async () => {
    await deletePrompt(prompt.id)
  }

  const handleToggleFavorite = async () => {
    await updatePrompt(prompt.id, { isFavorite: prompt.is_favorite ? 0 : 1 })
  }

  const handleToggleTag = async (tagId: string) => {
    const currentTags = [...promptTagIds]
    const idx = currentTags.indexOf(tagId)
    if (idx >= 0) {
      currentTags.splice(idx, 1)
    } else {
      currentTags.push(tagId)
    }
    await updatePrompt(prompt.id, { tags: currentTags })
  }

  const handleChangeFolder = async (folderId: string | null) => {
    await updatePrompt(prompt.id, { folderId })
    setFolderMenuAnchor(null)
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        {isEditing ? (
          <TextField
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            variant="standard"
            fullWidth
            sx={{
              '& .MuiInput-input': { fontSize: '1.25rem', fontWeight: 600 },
            }}
          />
        ) : (
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600, fontSize: '1.15rem' }} noWrap>
            {prompt.title}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <Tooltip title={copied ? '已复制!' : '复制内容'} arrow TransitionComponent={Fade}>
            <IconButton
              onClick={handleCopy}
              size="small"
              sx={{ color: copied ? 'success.main' : 'text.secondary' }}
            >
              {copied ? <CheckIcon /> : <ContentCopyIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title={prompt.is_favorite ? '取消收藏' : '收藏'} arrow>
            <IconButton
              onClick={handleToggleFavorite}
              size="small"
              sx={{ color: prompt.is_favorite ? '#fdd663' : 'text.secondary' }}
            >
              {prompt.is_favorite ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>

          {isEditing ? (
            <>
              <Button size="small" onClick={() => setIsEditing(false)}>取消</Button>
              <Button size="small" variant="contained" onClick={handleSave}>保存</Button>
            </>
          ) : (
            <Tooltip title="编辑" arrow>
              <IconButton
                onClick={() => setIsEditing(true)}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="删除" arrow>
            <IconButton
              onClick={handleDelete}
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Meta: folder + tags */}
      <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
        <Chip
          icon={<FolderIcon sx={{ fontSize: 16 }} />}
          label={currentFolder?.name || '未分类'}
          size="small"
          variant="outlined"
          onClick={(e) => setFolderMenuAnchor(e.currentTarget)}
          sx={{ cursor: 'pointer' }}
        />

        {promptTags.map((tag: any) => (
          <Chip
            key={tag.id}
            label={tag.name}
            size="small"
            onDelete={() => handleToggleTag(tag.id)}
            sx={{
              bgcolor: `${tag.color}22`,
              color: tag.color,
              border: 'none',
              '& .MuiChip-deleteIcon': { color: tag.color },
            }}
          />
        ))}

        <IconButton
          size="small"
          onClick={(e) => setTagMenuAnchor(e.currentTarget)}
          sx={{ color: 'text.secondary', border: '1px dashed', borderColor: 'divider', width: 28, height: 28 }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>

        {/* Folder Menu */}
        <Menu
          anchorEl={folderMenuAnchor}
          open={Boolean(folderMenuAnchor)}
          onClose={() => setFolderMenuAnchor(null)}
        >
          <MenuItem onClick={() => handleChangeFolder(null)}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>未分类</Typography>
          </MenuItem>
          {folders.map(f => (
            <MenuItem key={f.id} onClick={() => handleChangeFolder(f.id)} selected={f.id === prompt.folder_id}>
              <FolderIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
              {f.name}
            </MenuItem>
          ))}
        </Menu>

        {/* Tag Menu */}
        <Menu
          anchorEl={tagMenuAnchor}
          open={Boolean(tagMenuAnchor)}
          onClose={() => setTagMenuAnchor(null)}
        >
          {tags.map(tag => (
            <MenuItem key={tag.id} onClick={() => handleToggleTag(tag.id)}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: tag.color,
                  mr: 1,
                }}
              />
              {tag.name}
              {promptTagIds.includes(tag.id) && (
                <CheckIcon sx={{ fontSize: 16, ml: 'auto', color: 'success.main' }} />
              )}
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Divider />

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }} data-color-mode={themeMode}>
        {isEditing ? (
          <MDEditor
            value={editContent}
            onChange={(val) => setEditContent(val || '')}
            height="100%"
            preview="edit"
            style={{ height: '100%' }}
          />
        ) : (
          <Box sx={{ px: 1 }}>
            {prompt.content ? (
              <MDEditor.Markdown source={prompt.content} style={{ background: 'transparent' }} />
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontStyle: 'italic',
                  cursor: 'pointer',
                  '&:hover': { color: 'primary.main' },
                }}
                onClick={() => setIsEditing(true)}
              >
                点击此处开始编写 Prompt...
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
