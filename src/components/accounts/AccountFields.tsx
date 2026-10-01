import React, { useEffect, useState } from 'react'
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import {
  getAccountPlatformLabel,
  type AccountPlatform,
} from '../../utils/accountPlatform'
import { accountFieldRowSx } from './accountStyles'
import PlatformIcon from './PlatformIcon'

export const ACCOUNT_PLATFORM_ACCENTS: Record<AccountPlatform, string> = {
  google: '#8ddc9f',
  microsoft: '#adc6ff',
  github: '#b9a8ed',
  qq: '#73c9ed',
  apple: '#b4bbc5',
  other: '#8fa3ba',
}

export function AccountPlatformChip({ platform }: { platform: AccountPlatform }) {
  const accent = ACCOUNT_PLATFORM_ACCENTS[platform]
  return (
    <Chip
      size="small"
      label={getAccountPlatformLabel(platform)}
      icon={<PlatformIcon platform={platform} size={15} />}
      sx={{
        height: 24,
        fontWeight: 600,
        bgcolor: `${accent}22`,
        color: 'text.primary',
        border: '1px solid',
        borderColor: `${accent}55`,
        '& .MuiChip-label': { px: 1 },
        '& .MuiChip-icon': { ml: 0.75 },
      }}
    />
  )
}

export interface SensitiveAccountFieldProps {
  icon: React.ReactNode
  label: string
  value: string
  fieldKey: string
  copiedField: string | null
  onCopy: (value: string, key: string) => void
  editing: boolean
  onChange?: (value: string) => void
  onGenerate?: () => void
  onQuickSubmit?: (event: React.KeyboardEvent) => void
  error?: boolean
  helperText?: string
}

export function SensitiveAccountField({
  icon,
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
  editing,
  onChange,
  onGenerate,
  onQuickSubmit,
  error,
  helperText,
}: SensitiveAccountFieldProps) {
  const [visible, setVisible] = useState(false)
  const hasValue = value.length > 0
  const isSecretField = fieldKey === 'password' || fieldKey === 'totp_secret'

  useEffect(() => {
    setVisible(false)
  }, [editing, fieldKey])

  if (editing) {
    return (
      <TextField
        fullWidth
        size="small"
        label={label}
        value={value}
        type={isSecretField && !visible ? 'password' : 'text'}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={onQuickSubmit}
        error={error}
        helperText={helperText}
        InputProps={{
          startAdornment: <InputAdornment position="start">{icon}</InputAdornment>,
          endAdornment: onGenerate || isSecretField ? (
            <InputAdornment position="end">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {onGenerate && (
                  <Tooltip title="随机生成高强度密码">
                    <IconButton size="small" aria-label="随机生成高强度密码" onClick={onGenerate}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {isSecretField && (
                  <Tooltip title={visible ? '隐藏敏感值' : '显示敏感值'}>
                    <IconButton
                      size="small"
                      aria-label={visible ? `隐藏${label}` : `显示${label}`}
                      onClick={() => setVisible((current) => !current)}
                      edge="end"
                    >
                      {visible
                        ? <VisibilityOffIcon fontSize="small" />
                        : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </InputAdornment>
          ) : undefined,
        }}
        sx={{ mb: 1.5 }}
      />
    )
  }

  if (!hasValue) return null

  const requiresRevealBeforeCopy = fieldKey === 'totp_secret'
  const canCopy = !requiresRevealBeforeCopy || visible
  const isCopied = copiedField === fieldKey
  const handleCopy = () => {
    if (canCopy) void onCopy(value, fieldKey)
  }

  return (
    <Box
      sx={{
        ...accountFieldRowSx,
        mb: 0,
        borderColor: isCopied ? 'success.main' : 'border.subtle',
        bgcolor: isCopied ? 'rgba(52, 168, 83, 0.12)' : 'transparent',
        boxShadow: isCopied ? 'inset 0 0 0 1px rgba(52, 168, 83, 0.75)' : 'none',
        transition: 'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        '&:hover': {
          bgcolor: isCopied ? 'rgba(52, 168, 83, 0.16)' : 'action.hover',
        },
      }}
    >
      <Box
        component="button"
        type="button"
        disabled={!canCopy}
        aria-label={canCopy ? `复制${label}` : `${label}需先显示才能复制`}
        onClick={handleCopy}
        sx={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flex: 1,
          minWidth: 0,
          alignSelf: 'stretch',
          cursor: canCopy ? 'pointer' : 'default',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: isCopied ? 'success.main' : 'primary.main',
            outlineOffset: -2,
          },
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            color: 'primary.main',
            bgcolor: 'surface.sunken',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography
            variant="body2"
            className={isSecretField ? 'mono-data' : undefined}
            sx={{ color: 'text.primary', mt: 0.2, fontWeight: 600 }}
            noWrap
          >
            {isSecretField && !visible ? '••••••••' : value}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
        {requiresRevealBeforeCopy && !visible && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.74rem', lineHeight: 1.35 }}>
            先显示
          </Typography>
        )}
        {canCopy && (
          <Tooltip title={isCopied ? '已复制' : `复制${label}`}>
            <IconButton
              size="small"
              aria-label={`复制${label}`}
              onClick={(event) => {
                event.stopPropagation()
                handleCopy()
              }}
              sx={{ color: isCopied ? 'success.main' : 'text.secondary' }}
            >
              {isCopied
                ? <CheckIcon sx={{ fontSize: 16 }} />
                : <ContentCopyIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
        {isSecretField && (
          <Tooltip title={visible ? `隐藏${label}` : `显示${label}`}>
            <IconButton
              size="small"
              aria-label={visible ? `隐藏${label}` : `显示${label}`}
              onClick={(event) => {
                event.stopPropagation()
                setVisible((current) => !current)
              }}
              sx={{ color: 'text.secondary' }}
            >
              {visible
                ? <VisibilityOffIcon sx={{ fontSize: 16 }} />
                : <VisibilityIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
