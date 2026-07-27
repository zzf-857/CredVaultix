import React from 'react'
import { Box, Button, Typography } from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import CloseIcon from '@mui/icons-material/Close'
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined'

export default function BatchActionBar({
  count,
  onClear,
  onCreateGroup,
  onMoveToGroup,
  onUngroup,
}: {
  count: number
  onClear: () => void
  onCreateGroup: () => void
  onMoveToGroup: () => void
  onUngroup: () => void
}) {
  if (count === 0) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.75,
        mx: 1,
        my: 0.75,
        border: '1px solid',
        borderColor: 'border.subtle',
        borderRadius: 1,
        bgcolor: 'surface.raised',
        flexWrap: 'wrap',
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, mr: 0.5 }}>
        已选择 {count} 项
      </Typography>
      <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={onCreateGroup} sx={{ minWidth: 0 }}>
        创建分组
      </Button>
      <Button size="small" startIcon={<DriveFileMoveIcon />} onClick={onMoveToGroup} sx={{ minWidth: 0 }}>
        移入分组
      </Button>
      <Button size="small" startIcon={<WorkspacesOutlinedIcon />} onClick={onUngroup} sx={{ minWidth: 0 }}>
        移出分组
      </Button>
      <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={onClear} sx={{ minWidth: 0 }}>
        取消选择
      </Button>
    </Box>
  )
}
