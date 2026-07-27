import React, { useEffect, useState } from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import type { AccountRow, SecretGroupRow } from '../../types'
import SectionLabel from '../common/SectionLabel'
import type { ServiceFieldPreset, ServiceFormValues } from './serviceForm'

interface ServiceFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  values: ServiceFormValues
  groups: SecretGroupRow[]
  accounts: AccountRow[]
  busy: boolean
  onChange: (patch: Partial<ServiceFormValues>) => void
  onClose: () => void
  onSubmit: () => void
}

export default function ServiceFormDialog({
  open,
  mode,
  values,
  groups,
  accounts,
  busy,
  onChange,
  onClose,
  onSubmit,
}: ServiceFormDialogProps) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false)

  useEffect(() => {
    if (open) setApiKeyVisible(false)
  }, [open])

  const title = mode === 'create' ? '新建服务' : '编辑服务'
  const submitLabel = mode === 'create' ? '创建' : '保存'
  const busyLabel = mode === 'create' ? '创建中…' : '保存中…'

  const changePreset = (fieldPreset: ServiceFieldPreset) => {
    onChange({
      fieldPreset,
      baseUrl: fieldPreset === 'base-url-api-key' && !values.baseUrl ? values.url : values.baseUrl,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        component: 'form',
        onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          if (document.activeElement?.getAttribute('role') === 'combobox') return
          if (!busy && values.name.trim()) onSubmit()
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {mode === 'create'
          ? <AddIcon sx={{ color: 'primary.main' }} />
          : <EditOutlinedIcon sx={{ color: 'primary.main' }} />}
        {title}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          <TextField
            autoFocus
            fullWidth
            label="服务名称"
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
            disabled={busy}
            sx={{ gridColumn: '1 / -1' }}
          />

          <Autocomplete
            freeSolo
            selectOnFocus
            clearOnBlur
            handleHomeEndKeys
            options={groups.map((group) => group.name)}
            value={values.groupName}
            inputValue={values.groupName}
            onChange={(_event, value) => onChange({ groupName: value || '' })}
            onInputChange={(_event, value) => onChange({ groupName: value })}
            disabled={busy}
            renderInput={(params) => <TextField {...params} fullWidth label="分组" />}
          />

          <TextField
            select
            fullWidth
            label="关联主账号"
            value={values.linkedAccountId}
            onChange={(event) => onChange({ linkedAccountId: event.target.value })}
            disabled={busy}
          >
            <MenuItem value="">不关联账号</MenuItem>
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name} · {account.username || '未设置登录账号'}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="用途说明"
            value={values.description}
            onChange={(event) => onChange({ description: event.target.value })}
            disabled={busy}
            sx={{ gridColumn: '1 / -1' }}
          />

          <TextField
            fullWidth
            label="访问网址"
            value={values.url}
            onChange={(event) => onChange({ url: event.target.value })}
            disabled={busy}
            sx={{ gridColumn: '1 / -1' }}
          />

          <TextField
            select
            fullWidth
            label="字段预设"
            value={values.fieldPreset}
            onChange={(event) => changePreset(event.target.value as ServiceFieldPreset)}
            disabled={busy}
            sx={{ gridColumn: '1 / -1' }}
          >
            <MenuItem value="none">{mode === 'create' ? '不使用预设' : '不修改预设字段'}</MenuItem>
            <MenuItem value="base-url-api-key">Base URL + API Key</MenuItem>
          </TextField>

          {values.fieldPreset === 'base-url-api-key' && (
            <Box
              sx={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.5,
                pt: 0.5,
              }}
            >
              <Box sx={{ gridColumn: '1 / -1' }}>
                <SectionLabel>预设字段值</SectionLabel>
              </Box>
              <TextField
                fullWidth
                label="Base URL"
                value={values.baseUrl}
                onChange={(event) => onChange({ baseUrl: event.target.value })}
                disabled={busy}
              />
              <TextField
                fullWidth
                label="API Key"
                type={apiKeyVisible ? 'text' : 'password'}
                value={values.apiKey}
                onChange={(event) => onChange({ apiKey: event.target.value })}
                disabled={busy}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={apiKeyVisible ? '隐藏 API Key' : '显示 API Key'}>
                        <IconButton
                          size="small"
                          edge="end"
                          onClick={() => setApiKeyVisible((current) => !current)}
                          disabled={busy}
                          aria-label={apiKeyVisible ? '隐藏 API Key' : '显示 API Key'}
                        >
                          {apiKeyVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="备注"
            value={values.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            disabled={busy}
            sx={{ gridColumn: '1 / -1' }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onClose} disabled={busy}>取消</Button>
        <Button type="submit" variant="contained" disabled={busy || !values.name.trim()}>
          {busy ? busyLabel : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
