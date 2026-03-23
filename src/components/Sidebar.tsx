import React, { useState } from 'react'
import {
  Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, IconButton, Divider, Chip, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/FolderOutlined'
import AllInboxIcon from '@mui/icons-material/AllInboxOutlined'
import StarIcon from '@mui/icons-material/StarOutlined'
import LabelIcon from '@mui/icons-material/LabelOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import SecurityIcon from '@mui/icons-material/Security'
import AccountBoxIcon from '@mui/icons-material/AccountBox'
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined'
import { useStore } from '../stores/useStore'

export default function Sidebar() {
  const {
    folders, tags,
    selectedFolderId, selectedTagId, favoritesOnly,
    activeView, setActiveView,
    setSelectedFolder, setSelectedTag, setFavoritesOnly,
    createFolder, deleteFolder, updateFolder,
    createTag, deleteTag, updateTag,
    prompts,
  } = useStore()

  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#a8c7fa')
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null)
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color: string } | null>(null)
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null)
  const [hoveredTag, setHoveredTag] = useState<string | null>(null)

  const topLevelFolders = folders.filter(f => !f.parent_id)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    if (editingFolder) {
      await updateFolder(editingFolder.id, { name: newFolderName.trim() })
    } else {
      await createFolder(newFolderName.trim())
    }
    setNewFolderName('')
    setEditingFolder(null)
    setFolderDialogOpen(false)
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    if (editingTag) {
      await updateTag(editingTag.id, { name: newTagName.trim(), color: newTagColor })
    } else {
      await createTag(newTagName.trim(), newTagColor)
    }
    setNewTagName('')
    setNewTagColor('#a8c7fa')
    setEditingTag(null)
    setTagDialogOpen(false)
  }

  const tagColors = ['#a8c7fa', '#81c995', '#f2b8b5', '#fdd663', '#d7aefb', '#78d9ec', '#fcb68e']

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {/* Primary: Account Manager */}
        <List dense disablePadding>
          <ListItemButton
            selected={activeView === 'accounts'}
            onClick={() => setActiveView('accounts')}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AccountBoxIcon sx={{ fontSize: 20, color: '#a8c7fa' }} />
            </ListItemIcon>
            <ListItemText
              primary="账号管理"
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
            />
          </ListItemButton>
        </List>

        <Divider sx={{ my: 1, mx: 2 }} />

        {/* Tools section */}
        <Box sx={{ px: 2, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em' }}>
            工具
          </Typography>
        </Box>
        <List dense disablePadding>
          <ListItemButton
            selected={!selectedFolderId && !selectedTagId && !favoritesOnly && activeView === 'prompts'}
            onClick={() => { setActiveView('prompts'); setSelectedFolder(null); setSelectedTag(null); setFavoritesOnly(false) }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AllInboxIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            </ListItemIcon>
            <ListItemText
              primary="Prompt 管理"
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {prompts.length}
            </Typography>
          </ListItemButton>

          <ListItemButton
            selected={activeView === '2fa'}
            onClick={() => setActiveView('2fa')}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <SecurityIcon sx={{ fontSize: 20, color: '#78d9ec' }} />
            </ListItemIcon>
            <ListItemText
              primary="2FA 验证器"
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
            />
          </ListItemButton>

          <ListItemButton
            selected={activeView === 'address-generator'}
            onClick={() => setActiveView('address-generator')}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <LocationCityOutlinedIcon sx={{ fontSize: 20, color: '#f2b8b5' }} />
            </ListItemIcon>
            <ListItemText
              primary="地址生成器"
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
            />
          </ListItemButton>
        </List>

        <Divider sx={{ my: 1, mx: 2 }} />

        {/* Folders */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em', flex: 1 }}>
            文件夹
          </Typography>
          <IconButton
            size="small"
            onClick={() => { setEditingFolder(null); setNewFolderName(''); setFolderDialogOpen(true) }}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <List dense disablePadding>
          {topLevelFolders.map(folder => (
            <ListItemButton
              key={folder.id}
              selected={selectedFolderId === folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              onMouseEnter={() => setHoveredFolder(folder.id)}
              onMouseLeave={() => setHoveredFolder(null)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <FolderIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={folder.name}
                primaryTypographyProps={{ fontSize: '0.875rem', noWrap: true }}
              />
              {hoveredFolder === folder.id && (
                <Box sx={{ display: 'flex', gap: 0 }}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingFolder({ id: folder.id, name: folder.name })
                      setNewFolderName(folder.name)
                      setFolderDialogOpen(true)
                    }}
                    sx={{ color: 'text.secondary', p: 0.3 }}
                  >
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id) }}
                    sx={{ color: 'text.secondary', p: 0.3, '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )}
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ my: 1, mx: 2 }} />

        {/* Tags */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em', flex: 1 }}>
            标签
          </Typography>
          <IconButton
            size="small"
            onClick={() => { setEditingTag(null); setNewTagName(''); setNewTagColor('#a8c7fa'); setTagDialogOpen(true) }}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box sx={{ px: 2, py: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {tags.map(tag => (
            <Chip
              key={tag.id}
              label={tag.name}
              size="small"
              variant={selectedTagId === tag.id ? 'filled' : 'outlined'}
              onClick={() => setSelectedTag(selectedTagId === tag.id ? null : tag.id)}
              onMouseEnter={() => setHoveredTag(tag.id)}
              onMouseLeave={() => setHoveredTag(null)}
              onDelete={hoveredTag === tag.id ? () => deleteTag(tag.id) : undefined}
              sx={{
                borderColor: tag.color,
                color: selectedTagId === tag.id ? '#0f0f0f' : tag.color,
                bgcolor: selectedTagId === tag.id ? tag.color : 'transparent',
                '&:hover': { bgcolor: selectedTagId === tag.id ? tag.color : `${tag.color}22` },
                '& .MuiChip-deleteIcon': { color: 'inherit', fontSize: 16 },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* New Folder Dialog */}
      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingFolder ? '重命名文件夹' : '新建文件夹'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="文件夹名称"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateFolder}>
            {editingFolder ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Tag Dialog */}
      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingTag ? '编辑标签' : '新建标签'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="标签名称"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            sx={{ mt: 1, mb: 2 }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
            选择颜色
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {tagColors.map(c => (
              <Box
                key={c}
                onClick={() => setNewTagColor(c)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: c,
                  cursor: 'pointer',
                  border: newTagColor === c ? '3px solid white' : '3px solid transparent',
                  transition: 'border 0.15s ease',
                  '&:hover': { transform: 'scale(1.1)' },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateTag}>
            {editingTag ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
