import React from 'react'
import {
  Box, Typography, IconButton, TextField, InputAdornment,
  Button, Chip, Tooltip, Fade,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { useStore } from '../stores/useStore'

export default function PromptList() {
  const {
    prompts, tags, searchQuery,
    setSearchQuery, selectedPromptId, setSelectedPrompt,
    createPrompt, updatePrompt, loadData,
  } = useStore()

  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadData()
  }, [])

  // Reload when filters change
  const { selectedFolderId, selectedTagId, favoritesOnly } = useStore()
  React.useEffect(() => {
    loadData()
  }, [selectedFolderId, selectedTagId, favoritesOnly, searchQuery])

  const handleCopy = async (e: React.MouseEvent, content: string, id: string) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleToggleFavorite = async (e: React.MouseEvent, id: string, current: number) => {
    e.stopPropagation()
    await updatePrompt(id, { isFavorite: current ? 0 : 1 })
  }

  const handleNewPrompt = async () => {
    await createPrompt('未命名 Prompt', '')
  }

  const getTagsForPrompt = (tagIds: string | null) => {
    if (!tagIds) return []
    return tagIds.split(',').map(tid => tags.find(t => t.id === tid)).filter(Boolean)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins} 分钟前`
    if (diffHours < 24) return `${diffHours} 小时前`
    if (diffDays < 7) return `${diffDays} 天前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <Box
      sx={{
        width: 380,
        minWidth: 320,
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.default',
      }}
    >
      {/* Search + New button */}
      <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="搜索 Prompt..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
              fontSize: '0.875rem',
            },
          }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleNewPrompt}
          sx={{ minWidth: 'unset', px: 1.5, py: 1 }}
        >
          <AddIcon sx={{ fontSize: 20 }} />
        </Button>
      </Box>

      {/* Prompt list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {prompts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              暂无 Prompt
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleNewPrompt}>
              创建第一个 Prompt
            </Button>
          </Box>
        ) : (
          prompts.map((prompt) => {
            const promptTags = getTagsForPrompt(prompt.tag_ids)
            const isSelected = selectedPromptId === prompt.id

            return (
              <Box
                key={prompt.id}
                onClick={() => setSelectedPrompt(prompt.id)}
                sx={{
                  p: 1.5,
                  mb: 0.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  bgcolor: isSelected ? 'action.selected' : 'transparent',
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.dark' : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: isSelected ? 'action.selected' : 'action.hover',
                    '& .prompt-actions': { opacity: 1 },
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        mb: 0.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prompt.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mb: 0.5,
                      }}
                    >
                      {prompt.content.slice(0, 80) || '空内容'}
                    </Typography>
                  </Box>

                  <Box
                    className="prompt-actions"
                    sx={{
                      display: 'flex',
                      gap: 0.25,
                      opacity: isSelected ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    <Tooltip
                      title={copiedId === prompt.id ? '已复制!' : '复制'}
                      arrow
                      TransitionComponent={Fade}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => handleCopy(e, prompt.content, prompt.id)}
                        sx={{
                          color: copiedId === prompt.id ? 'success.main' : 'text.secondary',
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={(e) => handleToggleFavorite(e, prompt.id, prompt.is_favorite)}
                      sx={{ color: prompt.is_favorite ? '#fdd663' : 'text.secondary' }}
                    >
                      {prompt.is_favorite ? (
                        <StarIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <StarBorderIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                  {promptTags.slice(0, 3).map((tag: any) => (
                    <Chip
                      key={tag.id}
                      label={tag.name}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: `${tag.color}22`,
                        color: tag.color,
                        border: 'none',
                      }}
                    />
                  ))}
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    {formatTime(prompt.updated_at)}
                  </Typography>
                </Box>
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}
