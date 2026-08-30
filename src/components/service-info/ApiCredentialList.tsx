import React, { useMemo, useState } from 'react'
import { Alert, Box, Button, IconButton, Tooltip, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import TuneIcon from '@mui/icons-material/Tune'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import type { ModelProviderProfileDetail } from '../../../shared/serviceInfo'
import type { SecretFieldRow } from '../../types'
import useCopyFeedback from '../../hooks/useCopyFeedback'
import { isUndecryptedValue } from '../../utils/decryptionHealth'

export interface ApiCredentialListProps {
  profile: ModelProviderProfileDetail
  fields: SecretFieldRow[]
  onManage: () => void
  disabled?: boolean
}

export interface ResolvedApiCredentialFields {
  baseUrl: SecretFieldRow | null
  missingBaseUrlFieldId: string | null
  keys: Array<{
    metadata: ModelProviderProfileDetail['keys'][number]
    field: SecretFieldRow | null
  }>
}

export function resolveApiCredentialFields(
  profile: ModelProviderProfileDetail,
  fields: SecretFieldRow[]
): ResolvedApiCredentialFields {
  const fieldsById = new Map(fields.map((field) => [field.id, field]))
  const baseUrl = profile.baseUrlFieldId
    ? fieldsById.get(profile.baseUrlFieldId) || null
    : null

  return {
    baseUrl,
    missingBaseUrlFieldId: profile.baseUrlFieldId && !baseUrl ? profile.baseUrlFieldId : null,
    keys: [...profile.keys]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.fieldId.localeCompare(right.fieldId))
      .map((metadata) => ({ metadata, field: fieldsById.get(metadata.fieldId) || null })),
  }
}

export function isOpenableHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function CredentialAction({
  title,
  disabled,
  label,
  onClick,
  children,
}: {
  title: string
  disabled: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          sx={{ width: 28, height: 28 }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default function ApiCredentialList({
  profile,
  fields,
  onManage,
  disabled = false,
}: ApiCredentialListProps) {
  const [visibleKeyIds, setVisibleKeyIds] = useState<Set<string>>(() => new Set())
  const [actionError, setActionError] = useState('')
  const { copiedKey, copy } = useCopyFeedback()
  const resolved = useMemo(() => resolveApiCredentialFields(profile, fields), [fields, profile])

  const copyValue = async (value: string, feedbackKey: string) => {
    setActionError('')
    if (!await copy(value, feedbackKey)) {
      setActionError('复制失败，请检查系统剪贴板后重试')
    }
  }

  const openBaseUrl = async (value: string) => {
    setActionError('')
    try {
      const result = await window.electronAPI.openExternal(value)
      if (!result.success) setActionError(result.error || '无法打开 Base URL')
    } catch (error) {
      setActionError(`无法打开 Base URL：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const toggleKeyVisible = (fieldId: string) => {
    setVisibleKeyIds((current) => {
      const next = new Set(current)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      return next
    })
  }

  const baseUrl = resolved.baseUrl
  const baseUrlUndecryptable = Boolean(
    baseUrl?.is_secret && isUndecryptedValue(baseUrl.field_value)
  )
  const baseUrlCopied = baseUrl ? copiedKey === `base-url:${baseUrl.id}` : false

  return (
    <Box
      component="section"
      aria-label="API 凭据"
      sx={{
        border: '1px solid',
        borderColor: 'border.subtle',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          minHeight: 44,
          px: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          API 凭据
        </Typography>
        <Button
          size="small"
          startIcon={<TuneIcon />}
          onClick={onManage}
          disabled={disabled}
          sx={{ minHeight: 30, whiteSpace: 'nowrap' }}
        >
          管理 API Key
        </Button>
      </Box>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ borderRadius: 0 }}>
          {actionError}
        </Alert>
      )}

      {resolved.missingBaseUrlFieldId ? (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Base URL 引用的字段已缺失，请进入管理重新选择。
        </Alert>
      ) : baseUrl ? (
        <Box
          sx={{
            minHeight: 58,
            px: 1.25,
            py: 0.75,
            display: 'grid',
            gridTemplateColumns: '20px minmax(0, 1fr) 60px',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
          }}
        >
          <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600 }}>
              Base URL
            </Typography>
            <Tooltip title={baseUrlUndecryptable ? '该字段无法解密' : baseUrl.field_value || '(空)'}>
              <Typography
                variant="body2"
                noWrap
                className="mono-data"
                sx={{ mt: 0.15, color: baseUrlUndecryptable ? 'error.main' : 'text.primary' }}
              >
                {baseUrlUndecryptable ? '无法解密' : baseUrl.field_value || '(空)'}
              </Typography>
            </Tooltip>
          </Box>
          <Box sx={{ width: 60, display: 'grid', gridTemplateColumns: 'repeat(2, 28px)', gap: 0.5 }}>
            <CredentialAction
              title={baseUrlUndecryptable ? '字段无法解密，不能复制' : baseUrlCopied ? '已复制' : '复制 Base URL'}
              disabled={disabled || baseUrlUndecryptable || !baseUrl.field_value}
              label={baseUrlCopied ? '已复制 Base URL' : '复制 Base URL'}
              onClick={() => { void copyValue(baseUrl.field_value, `base-url:${baseUrl.id}`) }}
            >
              {baseUrlCopied ? <CheckIcon sx={{ fontSize: 17 }} /> : <ContentCopyIcon sx={{ fontSize: 17 }} />}
            </CredentialAction>
            <CredentialAction
              title={isOpenableHttpUrl(baseUrl.field_value) ? '打开 Base URL' : '仅支持打开 HTTP 或 HTTPS 地址'}
              disabled={disabled || baseUrlUndecryptable || !isOpenableHttpUrl(baseUrl.field_value)}
              label="打开 Base URL"
              onClick={() => { void openBaseUrl(baseUrl.field_value) }}
            >
              <OpenInNewIcon sx={{ fontSize: 17 }} />
            </CredentialAction>
          </Box>
        </Box>
      ) : (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          尚未配置 Base URL。
        </Alert>
      )}

      {resolved.keys.length === 0 ? (
        <Box sx={{ minHeight: 56, display: 'grid', placeItems: 'center', px: 1.25 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            尚未关联 API Key
          </Typography>
        </Box>
      ) : resolved.keys.map(({ metadata, field }, index) => {
        if (!field) {
          return (
            <Alert key={metadata.fieldId} severity="warning" sx={{ borderRadius: 0 }}>
              Key {index + 1} 引用的字段已缺失，请进入管理移除或重新选择。
            </Alert>
          )
        }

        const undecryptable = Boolean(field.is_secret) && isUndecryptedValue(field.field_value)
        const isConfigured = Boolean(field.field_value)
        const visible = visibleKeyIds.has(field.id) && !undecryptable && isConfigured
        const feedbackKey = `api-key:${field.id}`
        const copied = copiedKey === feedbackKey
        const displayValue = undecryptable
          ? '无法解密'
          : !isConfigured
            ? '未配置'
          : visible
            ? field.field_value
            : '••••••••'

        return (
          <Box
            key={metadata.fieldId}
            sx={{
              minHeight: 72,
              px: 1.25,
              py: 0.875,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr) 60px', sm: 'minmax(108px, 0.7fr) minmax(0, 1.3fr) minmax(86px, 0.55fr) 60px' },
              alignItems: 'center',
              gap: 1,
              borderBottom: '1px solid',
              borderColor: 'border.subtle',
              '&:last-child': { borderBottom: 0 },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 650 }}>
                {field.field_name}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{ display: 'block', color: field.is_secret ? 'text.secondary' : 'warning.main', mt: 0.15 }}
              >
                {field.is_secret ? `Key ${index + 1}` : `Key ${index + 1} · 历史明文存储`}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / 2', sm: 'auto' } }}>
              <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
                {metadata.purpose || '未填写用途'}
              </Typography>
              <Tooltip title={undecryptable ? '该 Key 无法解密，已禁用显示与复制' : !isConfigured ? '该 Key 尚未配置' : displayValue}>
                <Typography
                  variant="body2"
                  noWrap
                  className="mono-data"
                  sx={{ mt: 0.15, color: undecryptable ? 'error.main' : 'text.primary' }}
                >
                  {displayValue}
                </Typography>
              </Tooltip>
            </Box>
            <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / 2', sm: 'auto' } }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                手工余额
              </Typography>
              <Typography variant="body2" noWrap sx={{ mt: 0.15 }}>
                {metadata.manualBalance || '未记录'}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 60,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 28px)',
                gap: 0.5,
                gridColumn: { xs: '2 / 3', sm: 'auto' },
                gridRow: { xs: '1 / 4', sm: 'auto' },
              }}
            >
              <CredentialAction
                title={undecryptable ? '该 Key 无法解密，不能显示' : !isConfigured ? '该 Key 尚未配置' : visible ? '隐藏 API Key' : '显示 API Key'}
                disabled={disabled || undecryptable || !isConfigured}
                label={`${visible ? '隐藏' : '显示'} ${field.field_name}`}
                onClick={() => toggleKeyVisible(field.id)}
              >
                {visible ? <VisibilityOffIcon sx={{ fontSize: 17 }} /> : <VisibilityIcon sx={{ fontSize: 17 }} />}
              </CredentialAction>
              <CredentialAction
                title={undecryptable ? '该 Key 无法解密，不能复制' : copied ? '已复制' : '复制 API Key'}
                disabled={disabled || undecryptable || !field.field_value}
                label={copied ? `已复制 ${field.field_name}` : `复制 ${field.field_name}`}
                onClick={() => { void copyValue(field.field_value, feedbackKey) }}
              >
                {copied ? <CheckIcon sx={{ fontSize: 17 }} /> : <ContentCopyIcon sx={{ fontSize: 17 }} />}
              </CredentialAction>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
