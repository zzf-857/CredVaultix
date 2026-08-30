import { useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import {
  createServiceApiKeyDraft,
  isNewServiceApiKeyDraft,
  removeServiceApiKeyDraft,
  type ServiceApiKeyDraft,
} from './serviceForm'

export interface ApiKeyEditorValue {
  keys: ServiceApiKeyDraft[]
  detachKeyIds: string[]
  detachedApiKeys: ServiceApiKeyDraft[]
}

export interface ApiKeyEditorProps extends ApiKeyEditorValue {
  disabled?: boolean
  keyErrors?: Record<string, string | undefined>
  onChange: (value: ApiKeyEditorValue) => void
}

export default function ApiKeyEditor({
  keys,
  detachKeyIds,
  detachedApiKeys,
  disabled = false,
  keyErrors = {},
  onChange,
}: ApiKeyEditorProps) {
  const [visibleKeyIds, setVisibleKeyIds] = useState<Set<string>>(() => new Set())

  const updateKey = (fieldId: string, patch: Partial<ServiceApiKeyDraft>) => {
    onChange({
      keys: keys.map((key) => key.fieldId === fieldId ? { ...key, ...patch } : key),
      detachKeyIds,
      detachedApiKeys,
    })
  }

  const addKey = () => {
    onChange({ keys: [...keys, createServiceApiKeyDraft()], detachKeyIds, detachedApiKeys })
  }

  const removeKey = (fieldId: string) => {
    const next = removeServiceApiKeyDraft(keys, detachKeyIds, fieldId, detachedApiKeys)
    setVisibleKeyIds((current) => {
      if (!current.has(fieldId)) return current
      const updated = new Set(current)
      updated.delete(fieldId)
      return updated
    })
    onChange(next)
  }

  const toggleVisible = (fieldId: string) => {
    setVisibleKeyIds((current) => {
      const updated = new Set(current)
      if (updated.has(fieldId)) updated.delete(fieldId)
      else updated.add(fieldId)
      return updated
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {keys.map((key, index) => {
        const isNew = isNewServiceApiKeyDraft(key)
        const visible = visibleKeyIds.has(key.fieldId)
        const wasStoredAsPlaintext = key.originalIsSecret === false
        const keyError = keyErrors[key.fieldId]

        return (
          <Box
            key={key.fieldId}
            sx={{
              border: '1px solid',
              borderColor: 'border.subtle',
              borderRadius: 1,
              p: 1.25,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ minWidth: 0 }}>
                Key {index + 1}
              </Typography>
              <Tooltip title={isNew ? '移除 Key' : '解除模型 Key 关联；原字段和值仍保留'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => removeKey(key.fieldId)}
                    disabled={disabled}
                    aria-label={isNew ? `移除 Key ${index + 1}` : `移出模型 Key 列表 ${index + 1}`}
                    sx={{ width: 28, height: 28 }}
                  >
                    {isNew ? <DeleteOutlineIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <TextField
              size="small"
              fullWidth
              label="API Key"
              type={visible && !key.undecryptable ? 'text' : 'password'}
              value={key.value}
              onChange={(event) => {
                if (!key.undecryptable) updateKey(key.fieldId, { value: event.target.value })
              }}
              disabled={disabled || key.undecryptable}
              error={Boolean(keyError)}
              helperText={keyError}
              inputProps={{ 'aria-label': `Key ${index + 1} 值` }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={visible ? '隐藏 API Key' : '显示 API Key'}>
                      <span>
                        <IconButton
                          size="small"
                          edge="end"
                          onClick={() => toggleVisible(key.fieldId)}
                          disabled={disabled || key.undecryptable || !key.value}
                          aria-label={`${visible ? '隐藏' : '显示'} Key ${index + 1}`}
                        >
                          {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <TextField
                size="small"
                fullWidth
                label="用途备注"
                value={key.purpose}
                onChange={(event) => updateKey(key.fieldId, { purpose: event.target.value })}
                disabled={disabled}
                inputProps={{ 'aria-label': `Key ${index + 1} 用途备注` }}
              />
              <TextField
                size="small"
                fullWidth
                label="余额备注"
                value={key.manualBalance}
                onChange={(event) => updateKey(key.fieldId, { manualBalance: event.target.value })}
                disabled={disabled}
                inputProps={{ 'aria-label': `Key ${index + 1} 余额备注` }}
              />
            </Box>

            <Accordion
              disableGutters
              elevation={0}
              sx={{
                bgcolor: 'transparent',
                '&::before': { display: 'none' },
                '& .MuiAccordionSummary-root': { minHeight: 32, px: 0 },
                '& .MuiAccordionSummary-content': { my: 0.5 },
                '& .MuiAccordionDetails-root': { px: 0, pt: 0.5, pb: 0 },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  高级设置
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Key 名称"
                    value={key.label}
                    onChange={(event) => updateKey(key.fieldId, { label: event.target.value })}
                    disabled={disabled}
                    inputProps={{ 'aria-label': `Key ${index + 1} 名称` }}
                  />
                  {key.undecryptable && (
                    <Alert severity="error" sx={{ py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                      此 Key 无法解密，原始数据会保持不变。请勿在当前环境替换其值或加密状态。
                    </Alert>
                  )}
                  {wasStoredAsPlaintext && (
                    <Alert
                      severity="warning"
                      action={(
                        <FormControlLabel
                          sx={{ mr: 0, whiteSpace: 'nowrap' }}
                          control={(
                            <Switch
                              size="small"
                              checked={key.isSecret}
                              onChange={(event) => updateKey(key.fieldId, { isSecret: event.target.checked })}
                              disabled={disabled || key.undecryptable}
                              inputProps={{ 'aria-label': `加密保存 Key ${index + 1}` }}
                            />
                          )}
                          label="加密保存"
                        />
                      )}
                      sx={{ py: 0, alignItems: 'center', '& .MuiAlert-message': { py: 0.5 } }}
                    >
                      {key.isSecret
                        ? '保存后会将此历史明文字段改为加密存储。'
                        : '这是历史明文字段，请明确选择是否改为加密保存。'}
                    </Alert>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )
      })}

      <Box sx={{ minHeight: 32, display: 'flex', alignItems: 'center' }}>
        <Button size="small" startIcon={<AddIcon />} onClick={addKey} disabled={disabled}>
          添加 Key
        </Button>
      </Box>
    </Box>
  )
}
