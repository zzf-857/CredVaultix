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
        gap: 1,
        px: 1.5,
        py: 1,
        m: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
        flexWrap: 'wrap',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, mr: 0.5 }}>
        已选择 {count} 项
      </Typography>
      <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={onCreateGroup}>
        创建分组
      </Button>
      <Button size="small" startIcon={<DriveFileMoveIcon />} onClick={onMoveToGroup}>
        移入分组
      </Button>
      <Button size="small" startIcon={<WorkspacesOutlinedIcon />} onClick={onUngroup}>
        移出分组
      </Button>
      <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={onClear}>
        取消选择
      </Button>
    </Box>
  )
}
