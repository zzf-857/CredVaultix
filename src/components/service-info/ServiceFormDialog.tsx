import React, { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { AccountRow, SecretFieldRow, SecretGroupRow } from '../../types'
import SectionLabel from '../common/SectionLabel'
import ApiKeyEditor from './ApiKeyEditor'
import ProviderAutocomplete, { type ProviderAutocompleteValue } from './ProviderAutocomplete'
import {
  claimServiceApiKeyField,
  createExistingServiceBaseUrlSelection,
  createNewServiceBaseUrlSelection,
  createNoServiceBaseUrlSelection,
  createServiceApiKeyDraft,
  getServiceApiKeyDraftError,
  getServiceBaseUrlError,
  type ServiceFormValues,
} from './serviceForm'
import {
  getModelProviderById,
  normalizeProviderSearchText,
  type ModelProvider,
} from './modelProviders'

export interface ServiceFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  values: ServiceFormValues
  groups: SecretGroupRow[]
  accounts: AccountRow[]
  fields?: SecretFieldRow[]
  busy: boolean
  dirty?: boolean
  lockModelProviderMode?: boolean
  onPendingProviderInputChange?: (pending: boolean) => void
  onChange: (patch: Partial<ServiceFormValues>) => void
  onClose: () => void
  onSubmit: () => void
}

function mayReplaceDefault(currentValue: string, previousDefault: string | undefined) {
  return !currentValue.trim() || Boolean(previousDefault && currentValue === previousDefault)
}

export function buildProviderSelectionPatch(
  values: ServiceFormValues,
  provider: ModelProvider
): Partial<ServiceFormValues> {
  const previousProvider = getModelProviderById(values.providerId)
  const patch: Partial<ServiceFormValues> = { providerId: provider.id }

  if (mayReplaceDefault(values.name, previousProvider?.name)) {
    patch.name = provider.id === 'custom' ? values.name : provider.name
  }

  const canReplaceBaseUrl = values.baseUrlSource === 'new'
    ? mayReplaceDefault(values.baseUrl, previousProvider?.baseUrl)
    : values.baseUrlSource === 'existing'
      && values.baseUrlWasManaged
      && Boolean(previousProvider?.baseUrl)
      && values.baseUrl === previousProvider?.baseUrl

  if (provider.baseUrl && (values.baseUrlSource === 'none' || canReplaceBaseUrl)) {
    Object.assign(
      patch,
      values.baseUrlSource === 'none'
        ? createNewServiceBaseUrlSelection(provider.baseUrl)
        : { baseUrl: provider.baseUrl }
    )
  }

  if (provider.consoleUrl && mayReplaceDefault(values.url, previousProvider?.consoleUrl)) {
    patch.url = provider.consoleUrl
  }

  return patch
}

export function buildCustomProviderPatch(
  values: ServiceFormValues,
  inputValue: string,
  previousConfirmedName = ''
): Partial<ServiceFormValues> {
  const name = inputValue.trim()
  const previousProvider = getModelProviderById(values.providerId)
  const patch: Partial<ServiceFormValues> = {
    providerId: name ? 'custom' : '',
    ...(name && (
      !values.name.trim()
      || values.name === previousProvider?.name
      || values.name === previousConfirmedName
    ) ? { name } : {}),
  }

  if (!name && previousProvider && values.name === previousProvider.name) {
    patch.name = ''
  }

  if (previousProvider?.id !== 'custom') {
    if (previousProvider?.consoleUrl && values.url === previousProvider.consoleUrl) {
      patch.url = ''
    }
    if (previousProvider?.baseUrl && values.baseUrl === previousProvider.baseUrl) {
      if (values.baseUrlSource === 'new') {
        patch.baseUrl = ''
      } else if (values.baseUrlSource === 'existing' && values.baseUrlWasManaged) {
        Object.assign(patch, createNewServiceBaseUrlSelection())
      }
    }
  }

  return patch
}

export function serviceFormCanSubmit(values: ServiceFormValues, busy: boolean) {
  return !busy
    && Boolean(values.name.trim())
    && (values.mode === 'general' || Boolean(values.providerId.trim()))
}

export function getConfirmedProviderInput(values: ServiceFormValues) {
  if (values.providerId === 'custom') return values.name.trim()
  return getModelProviderById(values.providerId)?.name || values.providerId.trim()
}

export function isProviderInputPending(values: ServiceFormValues, inputValue: string) {
  if (values.mode !== 'model-provider') return false
  return normalizeProviderSearchText(inputValue)
    !== normalizeProviderSearchText(getConfirmedProviderInput(values))
}

export function getProviderInputError(values: ServiceFormValues, inputValue: string): string | null {
  if (values.mode !== 'model-provider') return null

  const input = inputValue.trim()
  const confirmedInput = getConfirmedProviderInput(values)
  const inputMatchesSelection = Boolean(values.providerId.trim())
    && normalizeProviderSearchText(input) === normalizeProviderSearchText(confirmedInput)

  if (inputMatchesSelection) return null
  if (input) return `请从列表选择厂商，或按 Enter 将“${input}”确认为自定义厂商`
  return '请选择厂商，或输入自定义厂商名称后按 Enter'
}

export function getBaseUrlFieldOptions(
  values: ServiceFormValues,
  fields: readonly SecretFieldRow[]
) {
  const activeKeyIds = new Set(values.apiKeys.map((key) => key.fieldId))
  const detachedKeyIds = new Set(values.detachKeyIds)
  return fields.filter((field) => {
    if (activeKeyIds.has(field.id) || detachedKeyIds.has(field.id)) return false
    if (field.id === values.baseUrlFieldId && values.baseUrlSource === 'existing') return true
    if (field.id === values.originalBaseUrlFieldId) return true
    return !Boolean(field.is_secret)
  })
}

export function getAvailableApiKeyFields(
  values: ServiceFormValues,
  fields: readonly SecretFieldRow[]
) {
  const activeKeyIds = new Set(values.apiKeys.map((key) => key.fieldId))
  return fields.filter((field) => (
    !activeKeyIds.has(field.id)
    && field.id !== values.baseUrlFieldId
    && field.id !== values.originalBaseUrlFieldId
  ))
}

export default function ServiceFormDialog({
  open,
  mode,
  values,
  groups,
  accounts,
  fields = [],
  busy,
  dirty = false,
  lockModelProviderMode = false,
  onPendingProviderInputChange,
  onChange,
  onClose,
  onSubmit,
}: ServiceFormDialogProps) {
  const [providerInputValue, setProviderInputValue] = useState('')
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setProviderInputValue(getConfirmedProviderInput(values))
    setCloseConfirmationOpen(false)
  }, [open, values.providerId, values.name])

  const selectedProvider = getModelProviderById(values.providerId)
  const confirmedProviderInput = getConfirmedProviderInput(values)
  const providerValue: ProviderAutocompleteValue = values.providerId === 'custom'
    ? values.name
    : selectedProvider || confirmedProviderInput || null
  const providerInputPending = isProviderInputPending(values, providerInputValue)
  const providerInputError = getProviderInputError(values, providerInputValue)
  const baseUrlError = values.mode === 'model-provider' ? getServiceBaseUrlError(values) : null
  const apiKeyErrors = useMemo(() => Object.fromEntries(
    values.apiKeys.flatMap((key) => {
      const error = getServiceApiKeyDraftError(key)
      return error ? [[key.fieldId, error]] : []
    })
  ), [values.apiKeys])
  const canSubmit = serviceFormCanSubmit(values, busy)
    && !providerInputError
    && !baseUrlError
    && Object.keys(apiKeyErrors).length === 0

  const activeKeyIds = useMemo(
    () => new Set(values.apiKeys.map((key) => key.fieldId)),
    [values.apiKeys]
  )
  const baseUrlFieldOptions = useMemo(
    () => getBaseUrlFieldOptions(values, fields),
    [values, fields]
  )

  const availableKeyFields = useMemo(
    () => getAvailableApiKeyFields(values, fields),
    [values, fields]
  )

  useEffect(() => {
    onPendingProviderInputChange?.(open && providerInputPending)
    return () => onPendingProviderInputChange?.(false)
  }, [onPendingProviderInputChange, open, providerInputPending])

  const requestClose = () => {
    if (busy) return
    if (dirty || providerInputPending) {
      setCloseConfirmationOpen(true)
      return
    }
    onClose()
  }

  const changeProvider = (nextValue: ProviderAutocompleteValue) => {
    if (typeof nextValue === 'string') {
      const nextInput = nextValue.trim()
      onChange(buildCustomProviderPatch(values, nextInput, confirmedProviderInput))
      setProviderInputValue(nextInput)
      return
    }

    if (!nextValue) {
      setProviderInputValue('')
      onChange(buildCustomProviderPatch(values, '', confirmedProviderInput))
      return
    }

    if (nextValue.id === 'custom') {
      setProviderInputValue(nextValue.name)
      onChange(buildCustomProviderPatch(values, nextValue.name, confirmedProviderInput))
      return
    }

    setProviderInputValue(nextValue.name)
    onChange(buildProviderSelectionPatch(values, nextValue))
  }

  const changeBaseUrlSource = (selection: string) => {
    if (selection === 'none') {
      onChange(createNoServiceBaseUrlSelection())
      return
    }

    if (selection === 'new') {
      if (values.baseUrlSource === 'new') return
      onChange(createNewServiceBaseUrlSelection(selectedProvider?.baseUrl || values.baseUrl))
      return
    }

    const fieldId = selection.replace(/^field:/, '')
    const field = fields.find((candidate) => candidate.id === fieldId)
    if (!field) return
    onChange(createExistingServiceBaseUrlSelection(
      field,
      field.id === values.originalBaseUrlFieldId
    ))
  }

  const claimExistingKey = (fieldId: string) => {
    const field = fields.find((candidate) => candidate.id === fieldId)
    if (!field || activeKeyIds.has(field.id)) return
    const next = claimServiceApiKeyField(
      values.apiKeys,
      values.detachKeyIds,
      field,
      values.detachedApiKeys
    )
    onChange({
      apiKeys: next.keys,
      detachKeyIds: next.detachKeyIds,
      detachedApiKeys: next.detachedApiKeys,
    })
  }

  const changeEditorMode = (_event: React.MouseEvent<HTMLElement>, nextMode: ServiceFormValues['mode'] | null) => {
    if (!nextMode || nextMode === values.mode) return
    onChange({
      mode: nextMode,
      ...(nextMode === 'model-provider' && values.apiKeys.length === 0
        ? { apiKeys: [createServiceApiKeyDraft()] }
        : {}),
    })
  }

  const title = mode === 'create' ? '新建服务' : '编辑服务'
  const submitLabel = mode === 'create' ? '创建' : '保存'
  const busyLabel = mode === 'create' ? '创建中…' : '保存中…'
  const baseUrlSelection = values.baseUrlSource === 'existing'
    ? `field:${values.baseUrlFieldId}`
    : values.baseUrlSource

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        fullWidth
        maxWidth="md"
        PaperProps={{
          component: 'form',
          sx: { maxHeight: 'calc(100vh - 32px)' },
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (document.activeElement?.getAttribute('role') === 'combobox') return
            if (canSubmit) onSubmit()
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {mode === 'create'
            ? <AddIcon sx={{ color: 'primary.main' }} />
            : <EditOutlinedIcon sx={{ color: 'primary.main' }} />}
          {title}
        </DialogTitle>

        <DialogContent dividers sx={{ overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              color="primary"
              value={values.mode}
              onChange={changeEditorMode}
              disabled={busy}
              aria-label="服务类型"
              sx={{ alignSelf: 'center', width: 'min(100%, 420px)' }}
            >
              <ToggleButton value="model-provider">模型 API</ToggleButton>
              <ToggleButton value="general" disabled={busy || lockModelProviderMode}>通用服务</ToggleButton>
            </ToggleButtonGroup>

            {values.mode === 'model-provider' && (
              <ProviderAutocomplete
                value={providerValue}
                inputValue={providerInputValue}
                onChange={(nextValue) => changeProvider(nextValue)}
                onInputChange={(nextInputValue) => {
                  setProviderInputValue(nextInputValue)
                }}
                disabled={busy}
                required
                autoFocus
                error={Boolean(providerInputError)}
                helperText={providerInputError || undefined}
              />
            )}

            {values.mode === 'general' && (
              <TextField
                autoFocus
                fullWidth
                required
                label="服务名称"
                value={values.name}
                onChange={(event) => onChange({ name: event.target.value })}
                disabled={busy}
              />
            )}

            {values.mode === 'model-provider' && (
              <>
                <TextField
                  fullWidth
                  label="Base URL"
                  value={values.baseUrl}
                  onChange={(event) => onChange({
                    ...(values.baseUrlSource === 'none'
                      ? createNewServiceBaseUrlSelection(event.target.value)
                      : { baseUrl: event.target.value }),
                  })}
                  disabled={busy}
                  placeholder="https://api.example.com/v1"
                  error={Boolean(baseUrlError)}
                  helperText={baseUrlError || undefined}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <SectionLabel>API Keys</SectionLabel>
                  <ApiKeyEditor
                    keys={values.apiKeys}
                    detachKeyIds={values.detachKeyIds}
                    detachedApiKeys={values.detachedApiKeys}
                    disabled={busy}
                    keyErrors={apiKeyErrors}
                    onChange={({ keys, detachKeyIds, detachedApiKeys }) => onChange({
                      apiKeys: keys,
                      detachKeyIds,
                      detachedApiKeys,
                    })}
                  />
                </Box>
              </>
            )}

            <Accordion
              disableGutters
              elevation={0}
              sx={{
                borderTop: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&::before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="service-more-settings-content">
                <Typography variant="subtitle2">更多设置</Typography>
              </AccordionSummary>
              <AccordionDetails id="service-more-settings-content">
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                  }}
                >
                  {values.mode === 'model-provider' && (
                    <TextField
                      fullWidth
                      required
                      label="服务名称"
                      value={values.name}
                      onChange={(event) => onChange({ name: event.target.value })}
                      disabled={busy}
                      sx={{ gridColumn: '1 / -1' }}
                    />
                  )}

                  {values.mode === 'model-provider' && fields.length > 0 && (
                    <>
                      <TextField
                        select
                        fullWidth
                        label="Base URL 字段"
                        value={baseUrlSelection}
                        onChange={(event) => changeBaseUrlSource(event.target.value)}
                        disabled={busy}
                      >
                        <MenuItem value="new">新建专用字段</MenuItem>
                        {baseUrlFieldOptions.map((field) => (
                          <MenuItem key={field.id} value={`field:${field.id}`}>
                            {field.field_name}
                          </MenuItem>
                        ))}
                        <MenuItem value="none">不关联字段</MenuItem>
                      </TextField>

                      <TextField
                        select
                        fullWidth
                        label="关联已有字段为 Key"
                        value=""
                        onChange={(event) => claimExistingKey(event.target.value)}
                        disabled={busy || availableKeyFields.length === 0}
                      >
                        <MenuItem value="" disabled>选择字段</MenuItem>
                        {availableKeyFields.map((field) => (
                          <MenuItem key={field.id} value={field.id}>
                            {field.field_name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </>
                  )}

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
                    label="控制台网址"
                    value={values.url}
                    onChange={(event) => onChange({ url: event.target.value })}
                    disabled={busy}
                    sx={{ gridColumn: '1 / -1' }}
                  />

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
                    multiline
                    minRows={3}
                    label="备注"
                    value={values.notes}
                    onChange={(event) => onChange({ notes: event.target.value })}
                    disabled={busy}
                    sx={{ gridColumn: '1 / -1' }}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button type="button" onClick={requestClose} disabled={busy}>取消</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {busy ? busyLabel : submitLabel}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={closeConfirmationOpen}
        onClose={() => setCloseConfirmationOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          放弃未保存内容？
        </DialogTitle>
        <DialogContent>
          <DialogContentText>当前修改尚未保存，关闭后将无法恢复。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseConfirmationOpen(false)}>继续编辑</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setCloseConfirmationOpen(false)
              onClose()
            }}
          >
            放弃修改
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
