import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Box, Typography, IconButton, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Fade, LinearProgress, Chip, Paper,
  MenuItem, Select, FormControl, InputLabel,
  InputAdornment,
  ToggleButton, ToggleButtonGroup,
  Alert, Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import SecurityIcon from '@mui/icons-material/Security'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import TimerIcon from '@mui/icons-material/Timer'
import PinIcon from '@mui/icons-material/Pin'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import LinkIcon from '@mui/icons-material/Link'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import GoogleIcon from '@mui/icons-material/Google'
import MicrosoftIcon from '@mui/icons-material/Microsoft'
import AppsIcon from '@mui/icons-material/Apps'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import * as OTPAuth from 'otpauth'
import { useStore } from '../stores/useStore'
import type { TotpAccountRow, TotpQrImageInput, TotpQrImagePayload, UpdateTotpData } from '../types'
import { parseOtpAuthUri, type ParsedOtpAuthUri } from '../utils/otpAuth'
import { isOtpAuthMigrationUri, parseOtpAuthMigrationUri } from '../utils/otpAuthMigration'
import { decodeTotpQrImage } from '../utils/qrImage'
import {
  applyTotpGroupOrder,
  groupTotpAccountsBySource,
  moveTotpGroupId,
  normalizeTotpSource,
  rememberTotpGroupAtEnd,
  sanitizeTotpGroupIdList,
  suggestGoogleMigrationSourceName,
  suggestSingleImportSourceName,
  toggleTotpGroupCollapsed,
  totpSourceGroupId,
} from '../utils/totpSource'

const TOTP_GROUP_DRAG_TYPE = 'application/x-credvaultix-totp-group'
import { isUndecryptedValue } from '../utils/decryptionHealth'
import useCopyFeedback from '../hooks/useCopyFeedback'
import { getTotpRemainingSeconds, getTotpWindow, useSharedNow } from '../hooks/useSharedNow'
import EmptyState from './common/EmptyState'
import PageHeader from './common/PageHeader'
import SectionLabel from './common/SectionLabel'

interface OtpCode {
  code: string
  remaining: number
  period: number
}

interface ResolvedTotpData {
  issuer: string
  label: string
  secret: string
  algorithm: string
  digits: number
  period: number
  otpType: string
  counter: number
  qrImage?: TotpQrImageInput | null
}

function getQrParameterSignature(data: {
  secret: string
  algorithm: string
  digits: number
  period: number
  otpType: string
}) {
  return [
    data.secret.replace(/\s/g, '').toUpperCase(),
    data.algorithm.toUpperCase(),
    data.digits,
    data.period,
    data.otpType.toLowerCase(),
  ].join('|')
}

function generateOtpCode(account: TotpAccountRow, timestampMs = Date.now()): OtpCode {
  try {
    const secretObj = OTPAuth.Secret.fromBase32(account.secret.replace(/\s/g, '').toUpperCase())

    if (account.otp_type === 'hotp') {
      const hotp = new OTPAuth.HOTP({
        issuer: account.issuer,
        label: account.label,
        algorithm: account.algorithm as any,
        digits: account.digits,
        counter: account.counter,
        secret: secretObj,
      })
      const code = hotp.generate({ counter: account.counter })
      return { code, remaining: -1, period: 0 }
    } else {
      const totp = new OTPAuth.TOTP({
        issuer: account.issuer,
        label: account.label,
        algorithm: account.algorithm as any,
        digits: account.digits,
        period: account.period,
        secret: secretObj,
      })
      const code = totp.generate({ timestamp: timestampMs })
      return {
        code,
        remaining: getTotpRemainingSeconds(timestampMs, account.period),
        period: account.period,
      }
    }
  } catch {
    return { code: '------', remaining: 0, period: 30 }
  }
}

function OtpTypeBadge({ type }: { type: string }) {
  const isTotp = type === 'totp'
  return (
    <Chip
      icon={isTotp ? <TimerIcon sx={{ fontSize: '14px !important' }} /> : <PinIcon sx={{ fontSize: '14px !important' }} />}
      label={isTotp ? '基于时间' : '基于计数器'}
      size="small"
      sx={{
        height: 24,
        fontSize: '0.68rem',
        fontWeight: 600,
        lineHeight: 1.35,
        bgcolor: 'surface.sunken',
        color: isTotp ? 'success.main' : 'info.main',
        border: '1px solid',
        borderColor: 'border.subtle',
        '& .MuiChip-icon': {
          color: 'inherit',
        },
        '& .MuiChip-label': {
          px: 0.8,
        },
      }}
    />
  )
}

function TotpCard({
  account,
  isPinned = false,
  onRequestDelete,
  onRequestEdit,
  onIncrementCounter,
  counterBusy = false,
  onNavigateToAccount,
  onViewQrImage,
}: {
  account: TotpAccountRow
  isPinned?: boolean
  onRequestDelete: (account: TotpAccountRow) => void
  onRequestEdit: (account: TotpAccountRow) => void
  onIncrementCounter: (id: string) => void
  counterBusy?: boolean
  onNavigateToAccount?: (accountId: string) => void
  onViewQrImage: (account: TotpAccountRow) => void
}) {
  const [otpCode, setOtpCode] = useState<OtpCode>(() => generateOtpCode(account))
  const nowMs = useSharedNow()
  const { copiedKey, copy } = useCopyFeedback()
  const copyKey = `card-code:${otpCode.code}`
  const copied = copiedKey === copyKey
  const [showSecret, setShowSecret] = useState(false)

  const isHotp = account.otp_type === 'hotp'
  const totpWindow = isHotp ? account.counter : getTotpWindow(nowMs, account.period)
  const remaining = isHotp ? -1 : getTotpRemainingSeconds(nowMs, account.period)
  const secretUndecryptable = isUndecryptedValue(account.secret)
  const linkedAccountState = account.linked_account_state
    || (account.linked_account_id?.startsWith('!deleted-') ? 'missing' : account.linked_account_id ? 'active' : 'unlinked')
  const isOrphaned = linkedAccountState === 'missing'
  const isLinkedAccountTrashed = linkedAccountState === 'trashed'

  useEffect(() => {
    const timestampMs = isHotp ? Date.now() : totpWindow * Math.max(account.period, 1) * 1000
    setOtpCode(generateOtpCode(account, timestampMs))
  }, [account, isHotp, totpWindow])

  const handleCopy = async () => {
    return copy(otpCode.code, copyKey)
  }

  const progress = !isHotp ? (remaining / account.period) * 100 : 100
  const isUrgent = !isHotp && remaining <= 5

  const formattedCode = otpCode.code.length === 6
    ? `${otpCode.code.slice(0, 3)} ${otpCode.code.slice(3)}`
    : otpCode.code

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 0,
        height: '100%',
        borderRadius: 1,
        border: '1px solid',
        borderColor: isPinned ? 'primary.main' : 'border.subtle',
        bgcolor: 'surface.raised',
        boxShadow: 'none',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          borderColor: isPinned ? 'primary.main' : 'border.strong',
          bgcolor: 'surface.elevated',
        },
      }}
    >
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'surface.sunken',
            border: '1px solid',
            borderColor: 'border.subtle',
            mr: 1.5,
            flexShrink: 0,
          }}
        >
          <SecurityIcon sx={{ fontSize: 20, color: isHotp ? 'info.main' : 'success.main' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.35, color: isOrphaned ? 'text.secondary' : 'text.primary', textDecoration: isOrphaned ? 'line-through' : 'none' }} noWrap>
              {account.issuer || account.label}
            </Typography>
            <OtpTypeBadge type={account.otp_type} />
            {secretUndecryptable && (
              <Tooltip title="该记录可能来自其他电脑或其他 Windows 用户的备份，当前环境无法还原密钥" arrow TransitionComponent={Fade}>
                <Chip
                  icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
                  label="密钥无法解密"
                  size="small"
                  sx={{
                    height: 24, fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.35,
                    bgcolor: 'surface.sunken', color: 'error.main', border: '1px solid', borderColor: 'error.main',
                  }}
                />
              </Tooltip>
            )}
            {isOrphaned || isLinkedAccountTrashed ? (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
                label={isLinkedAccountTrashed ? '主账号在回收站' : '主账号已删'}
                size="small"
                sx={{
                  height: 24, fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.35,
                  bgcolor: 'surface.sunken', color: 'error.main', border: '1px solid', borderColor: 'error.main',
                }}
              />
            ) : linkedAccountState === 'active' && account.linked_account_id && (
              <Tooltip title="已关联账号 · 点击跳转" arrow TransitionComponent={Fade}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onNavigateToAccount?.(account.linked_account_id!) }}
                  aria-label={`打开关联账号 ${account.label}`}
                  sx={{ p: 0.25, color: 'primary.main' }}
                >
                  <LinkIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {account.issuer && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem', mt: 0.3, lineHeight: 1.35 }} noWrap>
              {account.label}
              {isHotp && ` · 计数器: ${account.counter}`}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.25, ml: 0.75, flexShrink: 0 }}>
          {account.has_qr_image && (
            <Tooltip title="查看原始二维码">
              <IconButton
                size="small"
                onClick={() => onViewQrImage(account)}
                aria-label={`查看 ${account.issuer || account.label} 的原始二维码`}
                sx={{ color: 'text.secondary', '&:hover': { color: 'success.main' } }}
              >
                <QrCode2Icon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="编辑 2FA 账户">
            <IconButton
              size="small"
              onClick={() => onRequestEdit(account)}
              aria-label={`编辑 ${account.issuer || account.label}`}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <EditOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={showSecret ? '隐藏密钥' : '显示密钥'}>
            <IconButton
              size="small"
              onClick={() => setShowSecret(!showSecret)}
              aria-label={`${showSecret ? '隐藏' : '显示'} ${account.issuer || account.label} 的密钥`}
              aria-pressed={showSecret}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              {showSecret ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="删除 2FA 账户">
            <IconButton
              size="small"
              onClick={() => onRequestDelete(account)}
              aria-label={`删除 ${account.issuer || account.label}`}
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Code display */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1.15,
          px: 1.75,
          borderRadius: 1,
          bgcolor: copied ? 'rgba(52, 168, 83, 0.12)' : 'surface.sunken',
          border: '1px solid',
          borderColor: copied ? 'success.main' : 'border.subtle',
          boxShadow: copied ? 'inset 0 0 0 1px rgba(52, 168, 83, 0.55)' : 'none',
          '&:hover': { bgcolor: copied ? 'rgba(52, 168, 83, 0.16)' : 'surface.elevated' },
          transition: 'background-color 0.18s, border-color 0.18s, box-shadow 0.18s',
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label={`复制验证码 ${otpCode.code}`}
          onClick={() => { void handleCopy() }}
          sx={{
            all: 'unset',
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            borderRadius: 0.5,
            cursor: 'pointer',
            '&:focus-visible': { outline: '2px solid', outlineColor: copied ? 'success.main' : 'primary.main', outlineOffset: 2 },
          }}
        >
          <Typography
            variant="h4"
            className="mono-data"
            sx={{
              minWidth: 0,
              fontWeight: 700,
              letterSpacing: 0,
              fontSize: otpCode.code.length > 6 ? '1.4rem' : '1.65rem',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              color: isUrgent ? 'error.main' : 'primary.main',
              transition: 'color 0.3s',
            }}
          >
            {formattedCode}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          {isHotp ? (
            <Tooltip title="生成下一个验证码" arrow TransitionComponent={Fade}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onIncrementCounter(account.id) }}
                disabled={counterBusy}
                aria-label={`为 ${account.issuer || account.label} 生成下一个验证码`}
                sx={{ color: 'primary.main' }}
              >
                <RefreshIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Typography
              variant="caption"
              sx={{
                color: isUrgent ? 'error.main' : 'text.secondary',
                fontWeight: 600,
                fontSize: '0.8rem',
                minWidth: 20,
                textAlign: 'right',
              }}
            >
              {remaining}s
            </Typography>
          )}

          <Tooltip title={copied ? '已复制!' : '点击复制'} arrow TransitionComponent={Fade}>
            <IconButton
              size="small"
              aria-label={copied ? '验证码已复制' : '复制验证码'}
              onClick={(event) => { event.stopPropagation(); void handleCopy() }}
              sx={{ color: copied ? 'success.main' : 'text.secondary' }}
            >
              {copied ? <CheckIcon sx={{ fontSize: 18 }} /> : <ContentCopyIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Progress bar (TOTP only) */}
      {!isHotp && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mt: 1,
            height: 3,
            borderRadius: 2,
            bgcolor: 'divider',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              bgcolor: isUrgent ? 'error.main' : 'primary.main',
              transition: 'width 1s linear, background-color 0.3s',
            },
          }}
        />
      )}

      {showSecret && (
        <Typography
          variant="caption"
          sx={{
             mt: 1.25,
             display: 'block',
             color: 'text.secondary',
             fontSize: '0.65rem',
             lineHeight: 1.45,
             wordBreak: 'break-all',
          }}
          className="mono-data"
        >
          密钥: {account.secret}
        </Typography>
      )}
    </Paper>
  )
}

function TempTotpDisplay({
  secret,
  otpType,
  algorithm,
  digits,
  period,
  counter,
  onIncrementCounter,
}: {
  secret: string
  otpType: 'totp' | 'hotp'
  algorithm: string
  digits: number
  period: number
  counter: number
  onIncrementCounter: () => void
}) {
  const [code, setCode] = useState('------')
  const nowMs = useSharedNow()
  const { copiedKey, copy } = useCopyFeedback()
  const copyKey = `temporary-code:${code}`
  const copied = copiedKey === copyKey

  const isHotp = otpType === 'hotp'
  const totpWindow = isHotp ? counter : getTotpWindow(nowMs, period)
  const remaining = isHotp ? -1 : getTotpRemainingSeconds(nowMs, period)

  useEffect(() => {
    if (!secret || !secret.trim()) {
      setCode('------')
      return
    }

    try {
      const cleanSecret = secret.replace(/\s/g, '').toUpperCase()
      const secretObj = OTPAuth.Secret.fromBase32(cleanSecret)

      if (isHotp) {
        const hotp = new OTPAuth.HOTP({
          algorithm: algorithm as any,
          digits,
          counter,
          secret: secretObj,
        })
        setCode(hotp.generate({ counter }))
        return
      }

      const totp = new OTPAuth.TOTP({
        algorithm: algorithm as any,
        digits,
        period,
        secret: secretObj,
      })
      setCode(totp.generate({ timestamp: totpWindow * Math.max(period, 1) * 1000 }))
    } catch {
      setCode('------')
    }
  }, [algorithm, counter, digits, isHotp, period, secret, totpWindow])

  const handleCopy = async () => {
    if (code === '------') return false
    return copy(code, copyKey)
  }

  if (!secret || !secret.trim()) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
        等待输入密钥...
      </Typography>
    )
  }

  if (code === '------') {
    return (
      <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center', py: 2 }}>
        ⚠️ 密钥格式不正确，必须是合法的 Base32 编码（A-Z, 2-7）
      </Typography>
    )
  }

  const progress = !isHotp ? (remaining / period) * 100 : 100
  const isUrgent = !isHotp && remaining <= 5
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: isUrgent ? 'error.dark' : 'primary.main',
        bgcolor: 'surface.raised',
        transition: 'border-color 0.3s ease, background-color 0.3s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1.15,
          px: 1.75,
          borderRadius: 1,
          bgcolor: copied ? 'rgba(52, 168, 83, 0.12)' : 'surface.sunken',
          border: '1px solid',
          borderColor: copied ? 'success.main' : 'border.subtle',
          boxShadow: copied ? 'inset 0 0 0 1px rgba(52, 168, 83, 0.55)' : 'none',
          '&:hover': { bgcolor: copied ? 'rgba(52, 168, 83, 0.16)' : 'surface.elevated' },
          transition: 'background-color 0.18s, border-color 0.18s, box-shadow 0.18s',
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label={`复制验证码 ${code}`}
          onClick={() => { void handleCopy() }}
          sx={{
            all: 'unset',
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            borderRadius: 0.5,
            cursor: 'pointer',
            '&:focus-visible': { outline: '2px solid', outlineColor: copied ? 'success.main' : 'primary.main', outlineOffset: 2 },
          }}
        >
          <Typography
            variant="h4"
            className="mono-data"
            sx={{
              minWidth: 0,
              fontWeight: 700,
              letterSpacing: 0,
              fontSize: code.length > 6 ? '1.4rem' : '1.65rem',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              color: isUrgent ? 'error.main' : 'primary.main',
              transition: 'color 0.3s',
            }}
          >
            {formattedCode}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          {isHotp ? (
            <Tooltip title="生成下一个验证码" arrow TransitionComponent={Fade}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onIncrementCounter() }}
                aria-label="生成下一个临时验证码"
                sx={{ color: 'primary.main' }}
              >
                <RefreshIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Typography
              variant="caption"
              sx={{
                color: isUrgent ? 'error.main' : 'text.secondary',
                fontWeight: 600,
                fontSize: '0.8rem',
                minWidth: 20,
                textAlign: 'right',
              }}
            >
              {remaining}s
            </Typography>
          )}

          <Tooltip title={copied ? '已复制!' : '点击复制'} arrow TransitionComponent={Fade}>
            <IconButton
              size="small"
              aria-label={copied ? '验证码已复制' : '复制验证码'}
              onClick={(event) => { event.stopPropagation(); void handleCopy() }}
              sx={{ color: copied ? 'success.main' : 'text.secondary' }}
            >
              {copied ? <CheckIcon sx={{ fontSize: 18 }} /> : <ContentCopyIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {!isHotp && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mt: 1,
            height: 3,
            borderRadius: 2,
            bgcolor: 'divider',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              bgcolor: isUrgent ? 'error.main' : 'primary.main',
              transition: 'width 1s linear, background-color 0.3s',
            },
          }}
        />
      )}
    </Paper>
  )
}

export default function TwoFactorPanel() {
  const {
    totpAccounts,
    allAccounts: accounts,
    loadTotpAccounts,
    loadAllAccounts,
    createTotpAccount,
    updateTotpAccount,
    deleteTotpAccount,
    incrementTotpCounter,
    getTotpQrImage,
    copyTotpQrImage,
    saveTotpQrImage,
    navigateToAccount,
    accountsPinnedIds,
    accountsCustomOrder,
    dataRevision,
  } = useStore()

  // Alignment state with localStorage persistence and safety check
  const [alignment, setAlignment] = useState<'left' | 'center'>('left')
  const [activeGroup, setActiveGroup] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const listContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    window.electronAPI.getAppPreferences().then((preferences) => {
      if (!mounted) return
      let savedAlignment = preferences.twoFactorAlignment
      if (savedAlignment !== 'left' && savedAlignment !== 'center') {
        const legacyAlignment = localStorage.getItem('2fa_card_alignment')
        if (legacyAlignment === 'left' || legacyAlignment === 'center') {
          savedAlignment = legacyAlignment
          void window.electronAPI.updateAppPreferences({ twoFactorAlignment: savedAlignment })
          localStorage.removeItem('2fa_card_alignment')
        }
      }
      if (savedAlignment === 'left' || savedAlignment === 'center') {
        setAlignment(savedAlignment)
      }
      setGroupOrder(sanitizeTotpGroupIdList(preferences.twoFactorGroupOrder))
      setCollapsedGroupIds(sanitizeTotpGroupIdList(preferences.twoFactorCollapsedGroups))
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [dataRevision])

  const handleAlignmentChange = (newAlignment: 'left' | 'center') => {
    setAlignment(newAlignment)
    void window.electronAPI.updateAppPreferences({ twoFactorAlignment: newAlignment })
  }

  const sortAccounts = (accList: TotpAccountRow[]) => {
    // 1. 获取主账号的最权威渲染排序列表（与 AccountsView 完全一致，直接使用响应式全局 store 状态）
    const sortedMainAccounts = [...accounts].sort((a, b) => {
      const aPinned = accountsPinnedIds.includes(a.id)
      const bPinned = accountsPinnedIds.includes(b.id)
      
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1

      const aIndex = accountsCustomOrder.indexOf(a.id)
      const bIndex = accountsCustomOrder.indexOf(b.id)
      const aHas = aIndex !== -1
      const bHas = bIndex !== -1
      if (aHas && bHas) return aIndex - bIndex
      if (aHas && !bHas) return -1
      if (!aHas && bHas) return 1
      
      return 0
    })

    // 获取权威主账号 ID 的序列
    const mainAccountOrderIds = sortedMainAccounts.map(a => a.id)

    // 2. 根据主账号权威 ID 序列来决定关联 2FA 卡片在该区块内的相对位置
    return [...accList].sort((a, b) => {
      const aParentId = a.linked_account_id
      const bParentId = b.linked_account_id

      const aParentIndex = aParentId ? mainAccountOrderIds.indexOf(aParentId) : -1
      const bParentIndex = bParentId ? mainAccountOrderIds.indexOf(bParentId) : -1

      const aHasParent = aParentIndex !== -1
      const bHasParent = bParentIndex !== -1

      if (aHasParent && bHasParent) {
        return aParentIndex - bParentIndex
      }
      if (aHasParent && !bHasParent) return -1
      if (!aHasParent && bHasParent) return 1

      return 0
    })
  }
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inputMode, setInputMode] = useState<'manual' | 'uri' | 'qr'>('manual')
  const qrFileInputRef = useRef<HTMLInputElement>(null)
  const qrFormRequestRef = useRef(0)
  const qrFormBusyRef = useRef(false)
  const qrViewerRequestRef = useRef(0)
  const [qrImage, setQrImage] = useState<TotpQrImageInput | null>(null)
  const [qrImageChanged, setQrImageChanged] = useState(false)
  const [qrImageSignature, setQrImageSignature] = useState('')
  const [qrPreviewUrl, setQrPreviewUrl] = useState('')
  const [qrImageError, setQrImageError] = useState('')
  const [qrImageBusy, setQrImageBusy] = useState(false)
  const [pageDragActive, setPageDragActive] = useState(false)
  const [qrViewerAccount, setQrViewerAccount] = useState<TotpAccountRow | null>(null)
  const [qrViewerImage, setQrViewerImage] = useState<TotpQrImagePayload | null>(null)
  const [qrViewerBusy, setQrViewerBusy] = useState(false)
  const [qrActionBusy, setQrActionBusy] = useState<'copy' | 'save' | null>(null)
  const [qrCopied, setQrCopied] = useState(false)
  const [otpType, setOtpType] = useState<'totp' | 'hotp'>('totp')
  const [issuer, setIssuer] = useState('')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [secretVisible, setSecretVisible] = useState(false)
  const [algorithm, setAlgorithm] = useState<'SHA1' | 'SHA256' | 'SHA512'>('SHA1')
  const [digits, setDigits] = useState(6)
  const [period, setPeriod] = useState(30)
  const [counter, setCounter] = useState(0)
  const [uri, setUri] = useState('')
  const [uriError, setUriError] = useState('')
  const [manualError, setManualError] = useState('')
  const [editingTarget, setEditingTarget] = useState<TotpAccountRow | null>(null)
  const [mutationBusy, setMutationBusy] = useState(false)
  const mutationBusyRef = useRef(false)
  const counterBusyRef = useRef<string | null>(null)
  const [counterBusyId, setCounterBusyId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<TotpAccountRow | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Google Authenticator migration import
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false)
  const [migrationEntries, setMigrationEntries] = useState<ParsedOtpAuthUri[]>([])
  const [migrationSkippedCount, setMigrationSkippedCount] = useState(0)
  const [migrationSource, setMigrationSource] = useState('')
  const [pendingSourceScroll, setPendingSourceScroll] = useState('')
  const [importGroupMode, setImportGroupMode] = useState<'new' | 'existing'>('new')
  const [importGroupName, setImportGroupName] = useState('')
  const [importExistingSource, setImportExistingSource] = useState('')
  const [groupOrder, setGroupOrder] = useState<string[]>([])
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([])
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null)
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null)

  // Temporary generator states
  const [tempDialogOpen, setTempDialogOpen] = useState(false)
  const [tempInputMode, setTempInputMode] = useState<'manual' | 'uri'>('manual')
  const [tempOtpType, setTempOtpType] = useState<'totp' | 'hotp'>('totp')
  const [tempAlgorithm, setTempAlgorithm] = useState<'SHA1' | 'SHA256' | 'SHA512'>('SHA1')
  const [tempDigits, setTempDigits] = useState(6)
  const [tempPeriod, setTempPeriod] = useState(30)
  const [tempIssuer, setTempIssuer] = useState('')
  const [tempLabel, setTempLabel] = useState('')
  const [tempSecret, setTempSecret] = useState('')
  const [tempSecretVisible, setTempSecretVisible] = useState(false)
  const [tempUri, setTempUri] = useState('')
  const [tempUriError, setTempUriError] = useState('')
  const [tempCounter, setTempCounter] = useState(0)

  useEffect(() => {
    return () => {
      if (qrPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(qrPreviewUrl)
    }
  }, [qrPreviewUrl])

  const resetTempDialog = () => {
    setTempDialogOpen(false)
    setTempIssuer('')
    setTempLabel('')
    setTempSecret('')
    setTempSecretVisible(false)
    setTempUri('')
    setTempUriError('')
    setTempInputMode('manual')
    setTempOtpType('totp')
    setTempAlgorithm('SHA1')
    setTempDigits(6)
    setTempPeriod(30)
    setTempCounter(0)
  }

  const handleTempUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTempUri(val)
    setTempUriError('')

    if (!val.trim()) {
      setTempSecret('')
      return
    }

    const parsed = parseOtpAuthUri(val.trim())
    if (parsed) {
      setTempIssuer(parsed.issuer)
      setTempLabel(parsed.label)
      setTempSecret(parsed.secret)
      setTempOtpType(parsed.otpType as 'totp' | 'hotp')
      setTempAlgorithm(parsed.algorithm)
      setTempDigits(parsed.digits)
      setTempPeriod(parsed.period)
      setTempCounter(parsed.counter)
    } else {
      setTempUriError('无效的 otpauth URI')
      setTempSecret('')
    }
  }

  const handleSaveTempToPermanent = () => {
    setIssuer(tempIssuer)
    setLabel(tempLabel || tempIssuer || '临时转入账户')
    setSecret(tempSecret)
    setSecretVisible(false)
    setOtpType(tempOtpType)
    setAlgorithm(tempAlgorithm)
    setDigits(tempDigits)
    setPeriod(tempPeriod)
    setCounter(tempCounter)
    setInputMode(tempInputMode)
    setUri(tempUri)
    setEditingTarget(null)
    
    setTempDialogOpen(false)
    setDialogOpen(true)
  }

  const cancelQrFormRequest = () => {
    qrFormRequestRef.current += 1
    qrFormBusyRef.current = false
    setQrImageBusy(false)
    if (qrFileInputRef.current) qrFileInputRef.current.value = ''
  }

  const existingSources = useMemo(() => {
    const names = new Set<string>()
    for (const account of Array.isArray(totpAccounts) ? totpAccounts : []) {
      const source = normalizeTotpSource(account.source)
      if (source) names.add(source)
    }
    return Array.from(names).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  }, [totpAccounts])

  const openMigrationPreview = (entries: ParsedOtpAuthUri[], skippedCount: number) => {
    setMigrationEntries(entries)
    setMigrationSkippedCount(skippedCount)
    setMigrationSource(suggestGoogleMigrationSourceName(existingSources))
    setMigrationDialogOpen(true)
  }

  const persistGroupOrder = (nextOrder: string[]) => {
    setGroupOrder(nextOrder)
    void window.electronAPI.updateAppPreferences({ twoFactorGroupOrder: nextOrder })
  }

  const persistCollapsedGroups = (nextCollapsed: string[]) => {
    setCollapsedGroupIds(nextCollapsed)
    void window.electronAPI.updateAppPreferences({ twoFactorCollapsedGroups: nextCollapsed })
  }

  const rememberImportedGroup = (source: string, currentVisibleIds: string[]) => {
    const groupId = totpSourceGroupId(source)
    persistGroupOrder(rememberTotpGroupAtEnd(currentVisibleIds, groupOrder, groupId))
    return groupId
  }

  const resolveSingleImportSource = (issuerValue: string, labelValue: string) => {
    if (importGroupMode === 'existing') {
      const existing = normalizeTotpSource(importExistingSource)
      if (existing) return existing
    }
    return normalizeTotpSource(importGroupName) || suggestSingleImportSourceName(issuerValue, labelValue, existingSources)
  }

  const handleQrFile = async (file: File) => {
    const requestId = ++qrFormRequestRef.current
    qrFormBusyRef.current = true
    setQrImageBusy(true)
    setQrImageError('')
    try {
      const decoded = await decodeTotpQrImage(file)
      if (qrFormRequestRef.current !== requestId) {
        if (decoded.previewUrl.startsWith('blob:')) URL.revokeObjectURL(decoded.previewUrl)
        return
      }
      if (decoded.kind === 'migration') {
        if (decoded.previewUrl.startsWith('blob:')) URL.revokeObjectURL(decoded.previewUrl)
        if (editingTarget) {
          const message = '编辑现有账户时不能导入 Google Authenticator 批量迁移二维码'
          const keepsExistingImage = Boolean(qrImage || qrPreviewUrl || editingTarget.has_qr_image)
          setQrImageError(keepsExistingImage ? `更换失败，仍保留原二维码：${message}` : message)
          return
        }
        if (decoded.entries.length === 0) {
          setNotice({ severity: 'error', text: '迁移二维码中没有可导入的验证器账户' })
          return
        }
        if (dialogOpen) resetDialog()
        openMigrationPreview(decoded.entries, decoded.skippedCount)
        return
      }
      setQrImage(decoded.qrImage)
      setQrImageChanged(true)
      setQrImageSignature(getQrParameterSignature(decoded.parsed))
      setQrPreviewUrl(decoded.previewUrl)
      setIssuer(decoded.parsed.issuer)
      setLabel(decoded.parsed.label)
      setSecret(decoded.parsed.secret)
      setAlgorithm(decoded.parsed.algorithm)
      setDigits(decoded.parsed.digits)
      setPeriod(decoded.parsed.period)
      setOtpType(decoded.parsed.otpType)
      setCounter(decoded.parsed.counter)
      setInputMode('qr')
      setManualError('')
      setUriError('')
    } catch (error) {
      if (qrFormRequestRef.current === requestId) {
        const message = error instanceof Error ? error.message : String(error)
        const keepsExistingImage = Boolean(qrImage || qrPreviewUrl || editingTarget?.has_qr_image)
        setQrImageError(keepsExistingImage ? `更换失败，仍保留原二维码：${message}` : message)
      }
    } finally {
      if (qrFormRequestRef.current === requestId) {
        qrFormBusyRef.current = false
        setQrImageBusy(false)
        if (qrFileInputRef.current) qrFileInputRef.current.value = ''
      }
    }
  }

  const loadStoredQrPreview = async (account: TotpAccountRow) => {
    if (!account.has_qr_image || qrPreviewUrl) return
    const requestId = ++qrFormRequestRef.current
    qrFormBusyRef.current = true
    setQrImageBusy(true)
    setQrImageError('')
    try {
      const image = await getTotpQrImage(account.id)
      if (qrFormRequestRef.current !== requestId) return
      if (!image) throw new Error('未找到已保存的二维码图片')
      setQrPreviewUrl(image.dataUrl)
    } catch (error) {
      if (qrFormRequestRef.current === requestId) {
        setQrImageError(`读取二维码失败：${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      if (qrFormRequestRef.current === requestId) {
        qrFormBusyRef.current = false
        setQrImageBusy(false)
      }
    }
  }

  const selectQrInputMode = () => {
    if (qrFormBusyRef.current) return
    setInputMode('qr')
    if (editingTarget?.has_qr_image && !qrPreviewUrl && !qrImage) {
      void loadStoredQrPreview(editingTarget)
    }
  }

  const removeQrImage = () => {
    cancelQrFormRequest()
    setQrImage(null)
    setQrImageChanged(true)
    setQrImageSignature('')
    setQrPreviewUrl('')
    setQrImageError('')
  }

  const openQrViewer = async (account: TotpAccountRow) => {
    const requestId = ++qrViewerRequestRef.current
    setQrViewerAccount(account)
    setQrViewerImage(null)
    setQrViewerBusy(true)
    setQrCopied(false)
    try {
      const image = await getTotpQrImage(account.id)
      if (qrViewerRequestRef.current !== requestId) return
      if (!image) throw new Error('未找到已保存的二维码图片')
      setQrViewerImage(image)
    } catch (error) {
      if (qrViewerRequestRef.current === requestId) {
        setNotice({ severity: 'error', text: `读取二维码失败：${error instanceof Error ? error.message : String(error)}` })
        setQrViewerAccount(null)
        setQrViewerImage(null)
      }
    } finally {
      if (qrViewerRequestRef.current === requestId) setQrViewerBusy(false)
    }
  }

  const closeQrViewer = () => {
    if (qrActionBusy) return
    qrViewerRequestRef.current += 1
    setQrViewerAccount(null)
    setQrViewerImage(null)
    setQrViewerBusy(false)
    setQrCopied(false)
  }

  const handleCopyQrImage = async () => {
    if (!qrViewerAccount || qrActionBusy) return
    const viewerRequestId = qrViewerRequestRef.current
    setQrActionBusy('copy')
    try {
      const result = await copyTotpQrImage(qrViewerAccount.id)
      if (!result.success) throw new Error('复制失败')
      setQrCopied(true)
      setNotice({ severity: 'success', text: '二维码图片已复制到剪贴板，请注意其中包含敏感密钥' })
      window.setTimeout(() => {
        if (qrViewerRequestRef.current === viewerRequestId) setQrCopied(false)
      }, 1800)
    } catch (error) {
      setNotice({ severity: 'error', text: `复制二维码失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setQrActionBusy(null)
    }
  }

  const handleSaveQrImage = async () => {
    if (!qrViewerAccount || qrActionBusy) return
    setQrActionBusy('save')
    try {
      const result = await saveTotpQrImage(qrViewerAccount.id)
      if (!result.success && !result.canceled) throw new Error('保存失败')
      if (result.success) {
        setNotice({ severity: 'success', text: '二维码图片已保存，请妥善保管该敏感文件' })
      }
    } catch (error) {
      setNotice({ severity: 'error', text: `下载二维码失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setQrActionBusy(null)
    }
  }

  const loadPanelData = async () => {
    setLoadState('loading')
    setLoadError('')
    try {
      await Promise.all([loadTotpAccounts(), loadAllAccounts()])
      setLoadState('ready')
    } catch (error) {
      setLoadError(`读取 2FA 数据失败：${error instanceof Error ? error.message : String(error)}`)
      setLoadState('error')
    }
  }

  useEffect(() => {
    void loadPanelData()
  }, [loadAllAccounts, loadTotpAccounts])

  // Identify platform for grouping (Google, Microsoft, Others) with safe accessors
  const getAccountPlatform = (acc: TotpAccountRow) => {
    if (!acc) return 'other'

    if (acc.linked_account_id && Array.isArray(accounts)) {
      try {
        const parentAcc = accounts.find(a => a && a.id === acc.linked_account_id)
        if (parentAcc) {
          return parentAcc.platform
        }
      } catch (e) {
        console.error('Failed to find parent account platform:', e)
      }
    }
    
    const labelLower = (acc.label || '').toLowerCase()
    const issuerLower = (acc.issuer || '').toLowerCase()
    
    if (
      labelLower.includes('@gmail.com') ||
      labelLower.includes('gmail') ||
      labelLower.includes('google') ||
      issuerLower.includes('google') ||
      issuerLower.includes('gmail')
    ) {
      return 'google'
    }
    
    if (
      labelLower.includes('@outlook.com') ||
      labelLower.includes('@hotmail.com') ||
      labelLower.includes('@live.com') ||
      labelLower.includes('outlook') ||
      labelLower.includes('hotmail') ||
      labelLower.includes('microsoft') ||
      issuerLower.includes('microsoft') ||
      issuerLower.includes('outlook') ||
      issuerLower.includes('hotmail')
    ) {
      return 'microsoft'
    }
    
    return 'other'
  }

  const safeTotpAccounts = Array.isArray(totpAccounts) ? totpAccounts : []
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const filteredTotpAccounts = normalizedSearchQuery
    ? safeTotpAccounts.filter(acc => (
      (acc.issuer || '').toLowerCase().includes(normalizedSearchQuery)
      || (acc.label || '').toLowerCase().includes(normalizedSearchQuery)
      || (acc.source || '').toLowerCase().includes(normalizedSearchQuery)
    ))
    : safeTotpAccounts
  const { sourceGroups, unsourced } = useMemo(
    () => groupTotpAccountsBySource(filteredTotpAccounts),
    [filteredTotpAccounts]
  )
  const googleAccounts = unsourced.filter(acc => getAccountPlatform(acc) === 'google')
  const outlookAccounts = unsourced.filter(acc => getAccountPlatform(acc) === 'microsoft')
  const otherAccounts = unsourced.filter(acc => getAccountPlatform(acc) === 'other')
  const visibleGroups = [
    ...sourceGroups.map((group) => ({
      id: group.groupId,
      title: group.source,
      accounts: group.accounts,
      icon: <QrCode2Icon sx={{ fontSize: 16, color: 'primary.main' }} />,
      jumpIcon: <QrCode2Icon sx={{ fontSize: 22 }} />,
      color: 'primary.main',
    })),
    ...(googleAccounts.length > 0 ? [{
      id: 'group-google',
      title: 'Google / Gmail 账户',
      accounts: googleAccounts,
      icon: <GoogleIcon sx={{ fontSize: 16, color: 'success.main' }} />,
      jumpIcon: <GoogleIcon sx={{ fontSize: 22 }} />,
      color: 'success.main',
    }] : []),
    ...(outlookAccounts.length > 0 ? [{
      id: 'group-microsoft',
      title: 'Microsoft / Outlook 账户',
      accounts: outlookAccounts,
      icon: <MicrosoftIcon sx={{ fontSize: 16, color: 'info.main' }} />,
      jumpIcon: <MicrosoftIcon sx={{ fontSize: 22 }} />,
      color: 'info.main',
    }] : []),
    ...(otherAccounts.length > 0 ? [{
      id: 'group-other',
      title: '其他应用账户',
      accounts: otherAccounts,
      icon: <AppsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />,
      jumpIcon: <AppsIcon sx={{ fontSize: 22 }} />,
      color: 'text.primary',
    }] : []),
  ]
  const visibleGroupIds = applyTotpGroupOrder(visibleGroups.map((group) => group.id), groupOrder)
  const orderedGroups = visibleGroupIds
    .map((id) => visibleGroups.find((group) => group.id === id))
    .filter((group): group is typeof visibleGroups[number] => Boolean(group))

  useEffect(() => {
    setActiveGroup((currentGroup) => {
      if (currentGroup && visibleGroupIds.includes(currentGroup)) return currentGroup
      return visibleGroupIds[0] || ''
    })
  }, [visibleGroupIds.join('|')])

  const scrollToGroup = (groupId: string) => {
    const container = listContainerRef.current
    const target = container?.querySelector<HTMLElement>(`#${groupId}`)
    if (!container || !target) return

    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    container.scrollTo({
      top: container.scrollTop + targetRect.top - containerRect.top - 12,
      behavior: 'smooth',
    })
    setActiveGroup(groupId)
  }

  useEffect(() => {
    if (!pendingSourceScroll) return
    const groupId = totpSourceGroupId(pendingSourceScroll)
    if (!visibleGroupIds.includes(groupId)) return
    scrollToGroup(groupId)
    setPendingSourceScroll('')
  }, [pendingSourceScroll, visibleGroupIds.join('|')])

  const handleGroupScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    const containerTop = container.getBoundingClientRect().top
    const groupIds = visibleGroupIds
    const groups = groupIds
      .map(id => ({ id, element: container.querySelector<HTMLElement>(`#${id}`) }))
      .filter((group): group is { id: string; element: HTMLElement } => group.element !== null)

    if (groups.length === 0) return

    const activationLine = containerTop + 32
    let nextActiveGroup = groups[0].id
    for (const group of groups) {
      if (group.element.getBoundingClientRect().top <= activationLine) {
        nextActiveGroup = group.id
      } else {
        break
      }
    }

    setActiveGroup((currentGroup) => currentGroup === nextActiveGroup ? currentGroup : nextActiveGroup)
  }

  const renderQuickJumpButton = (
    groupId: string,
    label: string,
    icon: React.ReactNode,
    activeColor: string
  ) => {
    const isActive = activeGroup === groupId
    const isDropTarget = dropTargetGroupId === groupId
    const isDragging = draggingGroupId === groupId
    const collapsed = collapsedGroupIds.includes(groupId)

    return (
      <Tooltip key={groupId} title={`${label}${collapsed ? '（已折叠）' : ''} · 拖动可调整顺序`} placement="left" arrow>
        <Box
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(TOTP_GROUP_DRAG_TYPE, groupId)
            event.dataTransfer.effectAllowed = 'move'
            setDraggingGroupId(groupId)
          }}
          onDragOver={(event) => {
            if (![...event.dataTransfer.types].includes(TOTP_GROUP_DRAG_TYPE)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTargetGroupId(groupId)
          }}
          onDrop={(event) => {
            event.preventDefault()
            const fromId = event.dataTransfer.getData(TOTP_GROUP_DRAG_TYPE)
            if (fromId) persistGroupOrder(moveTotpGroupId(visibleGroupIds, fromId, groupId))
            setDraggingGroupId(null)
            setDropTargetGroupId(null)
          }}
          onDragEnd={() => {
            setDraggingGroupId(null)
            setDropTargetGroupId(null)
          }}
          sx={{
            borderRadius: 2.75,
            outline: isDropTarget ? '2px solid' : 'none',
            outlineColor: 'primary.main',
            opacity: isDragging ? 0.45 : 1,
          }}
        >
          <IconButton
            size="small"
            aria-label={label}
            aria-current={isActive ? 'location' : undefined}
            onClick={() => {
              if (collapsed) persistCollapsedGroups(toggleTotpGroupCollapsed(collapsedGroupIds, groupId))
              scrollToGroup(groupId)
            }}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.75,
              border: '1px solid',
              borderColor: isActive ? activeColor : 'transparent',
              color: isActive ? activeColor : 'text.secondary',
              bgcolor: isActive ? 'action.selected' : 'transparent',
              transition: 'background-color 0.18s, border-color 0.18s, color 0.18s',
              '&:hover': {
                color: activeColor,
                bgcolor: 'action.hover',
              },
            }}
          >
            {icon}
          </IconButton>
        </Box>
      </Tooltip>
    )
  }

  const renderAccountGroup = (
    title: string,
    icon: React.ReactNode,
    groupAccounts: TotpAccountRow[],
    groupId?: string
  ) => {
    if (groupAccounts.length === 0) return null

    // Sort accounts dynamically via the composite sorting engine (pinned first, then customOrder)
    const sortedAccounts = sortAccounts(groupAccounts)

    const collapsed = Boolean(groupId && collapsedGroupIds.includes(groupId))

    return (
      <Box id={groupId} sx={{ minWidth: 0, scrollMarginTop: 16 }}>
        <SectionLabel
          meta={`${groupAccounts.length} 个账户`}
          collapsed={collapsed}
          onToggle={groupId ? () => persistCollapsedGroups(toggleTotpGroupCollapsed(collapsedGroupIds, groupId)) : undefined}
        >
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {icon}
            {title}
          </Box>
        </SectionLabel>

        {!collapsed && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 420px))',
              gap: 1.5,
              width: '100%',
              justifyContent: alignment === 'center' ? 'center' : 'flex-start',
            }}
          >
            {sortedAccounts.map(account => (
              <TotpCard
                key={account.id}
                account={account}
                isPinned={account.linked_account_id ? accountsPinnedIds.includes(account.linked_account_id) : false}
                onRequestDelete={handleRequestDelete}
                onRequestEdit={openEditDialog}
                onIncrementCounter={handleIncrementCounter}
                counterBusy={counterBusyId !== null}
                onNavigateToAccount={navigateToAccount}
                onViewQrImage={openQrViewer}
              />
            ))}
          </Box>
        )}
      </Box>
    )
  }

  const isValidSecret = (value: string) => {
    try {
      OTPAuth.Secret.fromBase32(value.replace(/\s/g, '').toUpperCase())
      return true
    } catch {
      return false
    }
  }

  const openCreateDialog = (initialMode: 'manual' | 'qr' = 'manual') => {
    cancelQrFormRequest()
    setPageDragActive(false)
    setEditingTarget(null)
    setIssuer('')
    setLabel('')
    setSecret('')
    setSecretVisible(false)
    setAlgorithm('SHA1')
    setDigits(6)
    setPeriod(30)
    setCounter(0)
    setUri('')
    setUriError('')
    setManualError('')
    setInputMode(initialMode)
    setOtpType('totp')
    setQrImage(null)
    setQrImageChanged(false)
    setQrImageSignature('')
    setQrPreviewUrl('')
    setQrImageError('')
    setQrImageBusy(false)
    setImportGroupMode('new')
    setImportGroupName('')
    setImportExistingSource('')
    setDialogOpen(true)
  }

  const openEditDialog = (account: TotpAccountRow) => {
    cancelQrFormRequest()
    setPageDragActive(false)
    setEditingTarget(account)
    setIssuer(account.issuer || '')
    setLabel(account.label || '')
    setSecret(account.secret || '')
    setSecretVisible(false)
    setAlgorithm((['SHA1', 'SHA256', 'SHA512'].includes(account.algorithm?.toUpperCase())
      ? account.algorithm.toUpperCase()
      : 'SHA1') as 'SHA1' | 'SHA256' | 'SHA512')
    setDigits(account.digits || 6)
    setPeriod(account.period || 30)
    setCounter(account.counter || 0)
    setUri('')
    setUriError('')
    setManualError('')
    setInputMode('manual')
    setOtpType(account.otp_type === 'hotp' ? 'hotp' : 'totp')
    setQrImage(null)
    setQrImageChanged(false)
    setQrImageSignature('')
    setQrPreviewUrl('')
    setQrImageError('')
    setQrImageBusy(false)
    setDialogOpen(true)
  }

  const handlePanelDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setPageDragActive(false)
    if (dialogOpen || tempDialogOpen || deleteConfirmOpen || qrViewerAccount || migrationDialogOpen) return
    const file = Array.from(event.dataTransfer.files).find(candidate => (
      candidate.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(candidate.name)
    ))
    if (!file) {
      setNotice({ severity: 'error', text: '请拖入 PNG 或 JPEG 二维码图片' })
      return
    }
    openCreateDialog('qr')
    void handleQrFile(file)
  }

  const handleAdd = async () => {
    if (mutationBusyRef.current || qrFormBusyRef.current) return

    let nextData: ResolvedTotpData

    if (inputMode === 'uri') {
      const trimmedUri = uri.trim()
      if (isOtpAuthMigrationUri(trimmedUri)) {
        const migration = parseOtpAuthMigrationUri(trimmedUri)
        if (!migration || migration.entries.length === 0) {
          setUriError('无法解析 Google Authenticator 迁移数据')
          return
        }
        resetDialog()
        openMigrationPreview(migration.entries, migration.skippedCount)
        return
      }
      const parsed = parseOtpAuthUri(trimmedUri)
      if (!parsed) {
        setUriError('无效的 otpauth URI')
        return
      }
      nextData = parsed
    } else {
      if (!label.trim() || !secret.trim()) {
        setManualError('账户名称和密钥不能为空')
        return
      }
      if (!isValidSecret(secret)) {
        setManualError('密钥不是有效的 Base32 内容')
        return
      }
      setManualError('')
      nextData = {
        issuer: issuer.trim(),
        label: label.trim(),
        secret: secret.trim().replace(/\s/g, ''),
        algorithm,
        digits,
        period,
        otpType,
        counter,
      }
    }

    if (inputMode === 'qr') {
      const hasStoredQrImage = Boolean(editingTarget?.has_qr_image && !qrImageChanged)
      const isRemovingStoredQrImage = Boolean(editingTarget?.has_qr_image && qrImageChanged && !qrImage)
      if (!qrImage && !hasStoredQrImage && !isRemovingStoredQrImage) {
        setQrImageError('请先拖入或选择一张有效的二维码图片')
        return
      }
    }

    if (qrImageChanged && qrImage) {
      const currentSignature = getQrParameterSignature(nextData)
      if (qrImageSignature !== currentSignature) {
        setInputMode('qr')
        setQrImageError('当前验证参数与导入的二维码不一致，请重新导入图片')
        return
      }
    }

    mutationBusyRef.current = true
    setMutationBusy(true)
    try {
      let result: { refreshFailed: boolean }
      if (editingTarget) {
        const updateData: UpdateTotpData = {}
        const nextSecret = nextData.secret.replace(/\s/g, '').toUpperCase()
        const currentSecret = editingTarget.secret.replace(/\s/g, '').toUpperCase()
        if (nextData.issuer !== (editingTarget.issuer || '').trim()) updateData.issuer = nextData.issuer
        if (nextData.label !== (editingTarget.label || '').trim()) updateData.label = nextData.label
        if (nextSecret !== currentSecret) updateData.secret = nextSecret
        if (nextData.algorithm.toUpperCase() !== (editingTarget.algorithm || 'SHA1').toUpperCase()) updateData.algorithm = nextData.algorithm
        if (nextData.digits !== editingTarget.digits) updateData.digits = nextData.digits
        if (nextData.period !== editingTarget.period) updateData.period = nextData.period
        if (nextData.otpType !== editingTarget.otp_type) updateData.otpType = nextData.otpType
        if (nextData.counter !== editingTarget.counter) updateData.counter = nextData.counter
        if (qrImageChanged) updateData.qrImage = qrImage
        result = await updateTotpAccount(editingTarget.id, updateData)
      } else {
        if (qrImageChanged) nextData.qrImage = qrImage
        const source = resolveSingleImportSource(nextData.issuer, nextData.label)
        result = await createTotpAccount({ ...nextData, source })
        rememberImportedGroup(source, visibleGroupIds)
        setPendingSourceScroll(source)
      }
      setNotice({
        severity: result.refreshFailed ? 'info' : 'success',
        text: result.refreshFailed
          ? `${editingTarget ? '2FA 记录已更新' : '2FA 记录已添加'}，但界面刷新失败`
          : editingTarget ? '2FA 记录已更新' : '2FA 记录已添加',
      })
      if (!result.refreshFailed) {
        setLoadState('ready')
        setLoadError('')
      }
      resetDialog()
    } catch (error) {
      setNotice({ severity: 'error', text: `保存失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      mutationBusyRef.current = false
      setMutationBusy(false)
    }
  }

  const resetDialog = () => {
    cancelQrFormRequest()
    setPageDragActive(false)
    setDialogOpen(false)
    setIssuer('')
    setLabel('')
    setSecret('')
    setSecretVisible(false)
    setAlgorithm('SHA1')
    setDigits(6)
    setPeriod(30)
    setCounter(0)
    setUri('')
    setUriError('')
    setManualError('')
    setInputMode('manual')
    setOtpType('totp')
    setEditingTarget(null)
    setQrImage(null)
    setQrImageChanged(false)
    setQrImageSignature('')
    setQrPreviewUrl('')
    setQrImageError('')
    setQrImageBusy(false)
    setImportGroupMode('new')
    setImportGroupName('')
    setImportExistingSource('')
  }

  const closeMigrationDialog = () => {
    if (mutationBusyRef.current) return
    setMigrationDialogOpen(false)
    setMigrationEntries([])
    setMigrationSkippedCount(0)
    setMigrationSource('')
  }

  const handleMigrationImport = async () => {
    if (mutationBusyRef.current) return
    const source = normalizeTotpSource(migrationSource) || suggestGoogleMigrationSourceName(existingSources)
    mutationBusyRef.current = true
    setMutationBusy(true)
    try {
      let imported = 0
      let skipped = migrationSkippedCount
      let refreshFailed = false
      for (const entry of migrationEntries) {
        try {
          const result = await createTotpAccount({
            issuer: entry.issuer,
            label: entry.label,
            secret: entry.secret,
            algorithm: entry.algorithm,
            digits: entry.digits,
            period: entry.period,
            otpType: entry.otpType,
            counter: entry.counter,
            source,
          })
          imported += 1
          if (result.refreshFailed) refreshFailed = true
        } catch {
          skipped += 1
        }
      }

      if (imported === 0) {
        setNotice({ severity: 'error', text: '没有导入任何 2FA 账户' })
      } else {
        let text = `已导入 ${imported} 个 2FA 账户到「${source}」`
        if (skipped > 0) text += `；${skipped} 个已跳过`
        if (refreshFailed) text += '；界面刷新失败'
        setNotice({
          severity: skipped > 0 || refreshFailed ? 'info' : 'success',
          text,
        })
        rememberImportedGroup(source, visibleGroupIds)
        setPendingSourceScroll(source)
      }
      if (imported > 0 && !refreshFailed) {
        setLoadState('ready')
        setLoadError('')
      }
      setMigrationDialogOpen(false)
      setMigrationEntries([])
      setMigrationSkippedCount(0)
      setMigrationSource('')
    } finally {
      mutationBusyRef.current = false
      setMutationBusy(false)
    }
  }

  const handleRequestDelete = (account: TotpAccountRow) => {
    setDeleteTarget(account)
    setDeleteConfirmOpen(true)
  }

  const handleIncrementCounter = async (id: string) => {
    if (counterBusyRef.current) return
    counterBusyRef.current = id
    setCounterBusyId(id)
    try {
      const result = await incrementTotpCounter(id)
      if (result.refreshFailed) {
        setNotice({ severity: 'info', text: 'HOTP 计数器已递增，但验证码刷新失败；重新进入后会再次读取' })
      }
    } catch (error) {
      setNotice({ severity: 'error', text: `HOTP 计数器递增失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      counterBusyRef.current = null
      setCounterBusyId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || mutationBusyRef.current) return
    mutationBusyRef.current = true
    setMutationBusy(true)
    try {
      const result = await deleteTotpAccount(deleteTarget.id)
      setDeleteTarget(null)
      setDeleteConfirmOpen(false)
      setNotice({
        severity: result.refreshFailed ? 'info' : 'success',
        text: result.refreshFailed ? '2FA 记录已删除，但界面刷新失败' : '2FA 记录已删除',
      })
    } catch (error) {
      setNotice({ severity: 'error', text: `删除失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      mutationBusyRef.current = false
      setMutationBusy(false)
    }
  }

  return (
    <Box
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        if (dialogOpen || tempDialogOpen || deleteConfirmOpen || qrViewerAccount || migrationDialogOpen) {
          setPageDragActive(false)
          return
        }
        setPageDragActive(true)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        if (dialogOpen || tempDialogOpen || deleteConfirmOpen || qrViewerAccount || migrationDialogOpen) {
          setPageDragActive(false)
          return
        }
        setPageDragActive(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPageDragActive(false)
      }}
      onDrop={handlePanelDrop}
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden', bgcolor: 'surface.sunken', position: 'relative' }}
    >
      {pageDragActive && (
        <Box
          sx={{
            position: 'absolute',
            inset: 12,
            zIndex: 20,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.25,
            borderRadius: 3,
            border: '2px dashed',
            borderColor: 'primary.main',
            bgcolor: 'rgba(10, 14, 18, 0.9)',
            color: 'primary.main',
          }}
        >
          <FileUploadOutlinedIcon sx={{ fontSize: 44 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>松开以导入 2FA 二维码</Typography>
        </Box>
      )}
      <PageHeader
        compact
        icon={<SecurityIcon fontSize="small" />}
        title="2FA 验证器"
        description={
          normalizedSearchQuery
            ? `${filteredTotpAccounts.length}/${totpAccounts.length} 个验证账户`
            : `${totpAccounts.length} 个验证账户`
        }
        actions={
          <>
            <TextField
              size="small"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索 2FA 账户"
              inputProps={{ 'aria-label': '搜索 2FA 账户' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      aria-label="清空 2FA 搜索"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{ width: 200, '& .MuiOutlinedInput-root': { height: 32 } }}
            />
            <ToggleButtonGroup
              value={alignment}
              exclusive
              onChange={(e, newAlignment) => {
                if (newAlignment !== null) {
                  handleAlignmentChange(newAlignment)
                }
              }}
              size="small"
              aria-label="卡片对齐方式"
              sx={{
                height: 32,
                '& .MuiToggleButton-root': {
                  px: 1.1,
                  py: 0.5,
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    color: 'primary.main',
                    bgcolor: 'action.selected',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    }
                  }
                }
              }}
            >
              <ToggleButton value="left" aria-label="卡片左对齐">
                <Tooltip title="卡片左对齐">
                  <FormatAlignLeftIcon sx={{ fontSize: 16 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="center" aria-label="卡片居中">
                <Tooltip title="卡片居中">
                  <FormatAlignCenterIcon sx={{ fontSize: 16 }} />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="outlined"
              size="small"
              startIcon={<FlashOnIcon />}
              onClick={() => setTempDialogOpen(true)}
              aria-label="打开临时验证器"
              sx={{ height: 32, whiteSpace: 'nowrap' }}
            >
              临时验证器
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openCreateDialog()}
              aria-label="添加 2FA 账户"
              sx={{ height: 32, whiteSpace: 'nowrap' }}
            >
              添加账户
            </Button>
          </>
        }
      />

      {/* Account list */}
      <Box sx={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Account list */}
        <Box
          ref={listContainerRef}
          onScroll={handleGroupScroll}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            p: 2,
            pr: loadState === 'ready' && filteredTotpAccounts.length > 0 ? 14 : 2,
          }}
        >
          {loadState === 'loading' && <LinearProgress aria-label="正在读取 2FA 数据" sx={{ mb: 2 }} />}
          {loadState === 'error' ? (
            <Alert
              severity="error"
              action={<Button color="inherit" size="small" onClick={() => { void loadPanelData() }}>重试</Button>}
            >
              {loadError}
            </Alert>
          ) : loadState === 'ready' && (totpAccounts.length === 0 ? (
            <EmptyState
              compact
              icon={<SecurityIcon fontSize="small" />}
              title="暂无 2FA 账户"
              description="添加双因素认证账户，随时生成验证码"
              action={
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" startIcon={<FlashOnIcon />} onClick={() => setTempDialogOpen(true)}>
                    临时验证器
                  </Button>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreateDialog()}>
                    添加第一个账户
                  </Button>
                </Box>
              }
            />
          ) : filteredTotpAccounts.length === 0 ? (
            <EmptyState
              compact
              icon={<SearchIcon fontSize="small" />}
              title="没有匹配的 2FA 账户"
              description="试试调整搜索关键词，或清空搜索查看全部账户"
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
                pb: 1,
              }}
            >
              {orderedGroups.map((group) => renderAccountGroup(
                group.title,
                group.icon,
                group.accounts,
                group.id
              ))}
            </Box>
          ))}
        </Box>

        {loadState === 'ready' && filteredTotpAccounts.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              right: '40px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Paper
              component="nav"
              aria-label="2FA 分类快速跳转"
              elevation={0}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
                p: 0.75,
                borderRadius: 3.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {orderedGroups.map((group) => renderQuickJumpButton(
                group.id,
                `跳转到 ${group.title}`,
                group.jumpIcon,
                group.color
              ))}
            </Paper>
          </Box>
        )}
      </Box>

      {/* ========== Temporary Authenticator Dialog ========== */}
      <Dialog open={tempDialogOpen} onClose={resetTempDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlashOnIcon sx={{ color: 'primary.main' }} />
          临时验证器 (内存计算，不保存)
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.25, lineHeight: 1.55 }}>
            在这里，你可以快速生成一次性的 2FA 验证码。数据完全保留在内存中，关闭弹窗或重启软件后即被销毁，绝不写入数据库。
          </Typography>

          <Box sx={{ mb: 2.25, display: 'flex', gap: 1.1 }}>
            <Chip
              label="手动输入"
              variant={tempInputMode === 'manual' ? 'filled' : 'outlined'}
              onClick={() => setTempInputMode('manual')}
              color={tempInputMode === 'manual' ? 'primary' : 'default'}
            />
            <Chip
              label="粘贴 URI"
              variant={tempInputMode === 'uri' ? 'filled' : 'outlined'}
              onClick={() => setTempInputMode('uri')}
              color={tempInputMode === 'uri' ? 'primary' : 'default'}
            />
          </Box>

          {tempInputMode === 'manual' ? (
            <>
              {/* OTP Type selector */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>验证类型</InputLabel>
                <Select
                  value={tempOtpType}
                  label="验证类型"
                  onChange={(e) => setTempOtpType(e.target.value as 'totp' | 'hotp')}
                >
                  <MenuItem value="totp">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, py: 0.35 }}>
                      <TimerIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>基于时间 (TOTP)</Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.2, lineHeight: 1.35 }}>每 30 秒自动刷新验证码</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="hotp">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, py: 0.35 }}>
                      <PinIcon sx={{ fontSize: 18, color: 'info.main' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>基于计数器 (HOTP)</Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.2, lineHeight: 1.35 }}>手动点击生成下一个验证码</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="服务商（可选，如 Google）"
                value={tempIssuer}
                onChange={(e) => setTempIssuer(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="账户名称（可选，如 user@mail.com）"
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                required
                label="密钥（Base32 格式）"
                value={tempSecret}
                type={tempSecretVisible ? 'text' : 'password'}
                onChange={(e) => setTempSecret(e.target.value)}
                placeholder="如: JBSWY3DPEHPK3PXP"
                helperText="通常是一串大写字母和数字的组合"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={tempSecretVisible ? '隐藏密钥' : '显示密钥'}>
                        <IconButton
                          size="small"
                          onClick={() => setTempSecretVisible((current) => !current)}
                          edge="end"
                          aria-label={tempSecretVisible ? '隐藏临时验证密钥' : '显示临时验证密钥'}
                          aria-pressed={tempSecretVisible}
                        >
                          {tempSecretVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />
            </>
          ) : (
            <TextField
              fullWidth
              required
              label="otpauth:// URI"
              value={tempUri}
              onChange={handleTempUriChange}
              placeholder="otpauth://totp/Example:user@example.com?secret=..."
              multiline
              rows={3}
              error={!!tempUriError}
              helperText={tempUriError || '粘贴你的 2FA 应用提供的 otpauth:// 链接'}
              sx={{ mb: 3 }}
            />
          )}

          {/* Real-time Code Display Section */}
          <Box sx={{ mt: 1, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.1, fontWeight: 600, lineHeight: 1.35 }}>
              实时生成验证码
            </Typography>
            <TempTotpDisplay
              secret={tempSecret}
              otpType={tempOtpType}
              algorithm={tempAlgorithm}
              digits={tempDigits}
              period={tempPeriod}
              counter={tempCounter}
              onIncrementCounter={() => setTempCounter(prev => prev + 1)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={resetTempDialog} color="inherit">
            关闭
          </Button>
          {tempSecret && tempSecret.trim() && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveTempToPermanent}
              startIcon={<AddIcon />}
            >
              保存为正式账户
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ========== Add Account Dialog ========== */}
      <Dialog
        open={dialogOpen}
        onClose={() => { if (!mutationBusy) resetDialog() }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          component: 'form',
          noValidate: true,
          onDragOver: (event: React.DragEvent<HTMLFormElement>) => {
            if (!event.dataTransfer.types.includes('Files')) return
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = 'copy'
          },
          onDrop: (event: React.DragEvent<HTMLFormElement>) => {
            event.preventDefault()
            event.stopPropagation()
            setPageDragActive(false)
            setInputMode('qr')
            const file = Array.from(event.dataTransfer.files).find(candidate => (
              candidate.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(candidate.name)
            ))
            if (!file) {
              setQrImageError('请拖入 PNG 或 JPEG 二维码图片')
              return
            }
            void handleQrFile(file)
          },
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!mutationBusy) void handleAdd()
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: 'primary.main' }} />
          {editingTarget ? '编辑 2FA 账户' : '添加 2FA 账户'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2.25, display: 'flex', gap: 1.1 }}>
            <Chip
              label="手动输入"
              variant={inputMode === 'manual' ? 'filled' : 'outlined'}
              onClick={() => { cancelQrFormRequest(); setInputMode('manual') }}
              color={inputMode === 'manual' ? 'primary' : 'default'}
            />
            <Chip
              label="粘贴 URI"
              variant={inputMode === 'uri' ? 'filled' : 'outlined'}
              onClick={() => { cancelQrFormRequest(); setInputMode('uri') }}
              color={inputMode === 'uri' ? 'primary' : 'default'}
            />
            <Chip
              icon={<QrCode2Icon sx={{ fontSize: '16px !important' }} />}
              label="二维码图片"
              variant={inputMode === 'qr' ? 'filled' : 'outlined'}
              onClick={selectQrInputMode}
              color={inputMode === 'qr' ? 'primary' : 'default'}
            />
          </Box>

          {inputMode === 'manual' ? (
            <>
              {/* OTP Type selector */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>验证类型</InputLabel>
                <Select
                  value={otpType}
                  label="验证类型"
                  onChange={(e) => setOtpType(e.target.value as 'totp' | 'hotp')}
                >
                  <MenuItem value="totp">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, py: 0.35 }}>
                      <TimerIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>基于时间 (TOTP)</Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.2, lineHeight: 1.35 }}>每 30 秒自动刷新验证码</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="hotp">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, py: 0.35 }}>
                      <PinIcon sx={{ fontSize: 18, color: 'info.main' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.35 }}>基于计数器 (HOTP)</Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.2, lineHeight: 1.35 }}>手动点击生成下一个验证码</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="服务商（如 Google、GitHub）"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                required
                label="账户名称"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                required
                label="密钥（Base32 格式）"
                value={secret}
                type={secretVisible ? 'text' : 'password'}
                onChange={(e) => { setSecret(e.target.value); setManualError('') }}
                placeholder="如: JBSWY3DPEHPK3PXP"
                error={Boolean(manualError)}
                helperText={manualError || '通常是一串大写字母和数字的组合'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={secretVisible ? '隐藏密钥' : '显示密钥'}>
                        <IconButton
                          type="button"
                          size="small"
                          onClick={() => setSecretVisible((current) => !current)}
                          edge="end"
                          aria-label={secretVisible ? '隐藏账户密钥' : '显示账户密钥'}
                          aria-pressed={secretVisible}
                        >
                          {secretVisible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, mt: 2 }}>
                <TextField
                  select
                  label="算法"
                  value={algorithm}
                  onChange={(event) => setAlgorithm(event.target.value as 'SHA1' | 'SHA256' | 'SHA512')}
                >
                  <MenuItem value="SHA1">SHA1</MenuItem>
                  <MenuItem value="SHA256">SHA256</MenuItem>
                  <MenuItem value="SHA512">SHA512</MenuItem>
                </TextField>
                <TextField
                  select
                  label="验证码位数"
                  value={digits}
                  onChange={(event) => setDigits(Number(event.target.value))}
                >
                  {Array.from(new Set([6, 8, digits])).sort((a, b) => a - b).map((d) => (
                    <MenuItem key={d} value={d}>{`${d} 位`}</MenuItem>
                  ))}
                </TextField>
                {otpType === 'totp' ? (
                  <TextField
                    type="number"
                    label="刷新周期（秒）"
                    value={period}
                    inputProps={{ min: 5, max: 300, step: 1 }}
                    onChange={(event) => setPeriod(Math.max(5, Math.min(300, Number(event.target.value) || 30)))}
                    sx={{ gridColumn: '1 / -1' }}
                  />
                ) : (
                  <TextField
                    type="number"
                    label="当前计数器"
                    value={counter}
                    inputProps={{ min: 0, step: 1 }}
                    onChange={(event) => setCounter(Math.max(0, Number(event.target.value) || 0))}
                    sx={{ gridColumn: '1 / -1' }}
                  />
                )}
              </Box>
            </>
          ) : inputMode === 'uri' ? (
            <TextField
              fullWidth
              required
              label="otpauth:// URI"
              value={uri}
              onChange={(e) => { setUri(e.target.value); setUriError('') }}
              placeholder="otpauth://totp/Example:user@example.com?secret=..."
              multiline
              rows={3}
              error={!!uriError}
              helperText={uriError || '粘贴你的 2FA 应用提供的 otpauth:// 链接（支持 TOTP 和 HOTP）'}
            />
          ) : (
            <Box>
              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleQrFile(file)
                }}
              />
              <Box
                role="button"
                tabIndex={0}
                aria-label="拖入或选择 2FA 二维码图片"
                onClick={() => { if (!qrImageBusy) qrFileInputRef.current?.click() }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if ((event.key === 'Enter' || event.key === ' ') && !qrImageBusy) {
                    event.preventDefault()
                    qrFileInputRef.current?.click()
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setPageDragActive(false)
                  const file = Array.from(event.dataTransfer.files).find(candidate => (
                    candidate.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(candidate.name)
                  ))
                  if (file) void handleQrFile(file)
                }}
                sx={{
                  minHeight: qrPreviewUrl ? 190 : 220,
                  p: 2,
                  borderRadius: 2.5,
                  border: '2px dashed',
                  borderColor: qrImageError ? 'error.main' : qrPreviewUrl ? 'success.main' : 'border.strong',
                  bgcolor: qrPreviewUrl ? 'rgba(52, 168, 83, 0.06)' : 'surface.sunken',
                  cursor: qrImageBusy ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.18s, background-color 0.18s',
                  '&:hover': { borderColor: qrImageError ? 'error.main' : 'primary.main', bgcolor: 'surface.elevated' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                {qrPreviewUrl ? (
                  <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px minmax(0, 1fr)' }, gap: 2, alignItems: 'center' }}>
                    <Box
                      component="img"
                      src={qrPreviewUrl}
                      alt="已导入的 2FA 二维码"
                      sx={{ width: 150, height: 150, objectFit: 'contain', borderRadius: 2, bgcolor: '#fff', p: 1, justifySelf: { xs: 'center', sm: 'auto' } }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'success.main', mb: 0.75 }}>
                        <CheckIcon sx={{ fontSize: 20 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>二维码已识别</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55, mb: 1.5 }}>
                        已读取验证参数，保存后原图会加密存入数据库。
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          type="button"
                          size="small"
                          variant="outlined"
                          startIcon={<FolderOpenIcon />}
                          onClick={(event) => { event.stopPropagation(); qrFileInputRef.current?.click() }}
                          disabled={qrImageBusy}
                        >
                          更换图片
                        </Button>
                        <Button
                          type="button"
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={(event) => { event.stopPropagation(); removeQrImage() }}
                        >
                          删除图片
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    <FileUploadOutlinedIcon sx={{ fontSize: 42, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                      拖入二维码图片
                    </Typography>
                    <Typography variant="body2">或点击选择 PNG / JPEG 文件，最大 10 MB</Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.75, lineHeight: 1.45 }}>
                      Google 迁移码请尽量只截取一张二维码，不要带上整屏界面
                    </Typography>
                  </Box>
                )}
              </Box>
              {qrImageBusy && <LinearProgress aria-label="正在识别二维码" sx={{ mt: 1 }} />}
              {qrImageError && <Alert severity="error" sx={{ mt: 1.5 }}>{qrImageError}</Alert>}

              {(qrPreviewUrl || qrImage || editingTarget?.has_qr_image) && (
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                  <TextField
                    label="服务商"
                    value={issuer}
                    onChange={(event) => setIssuer(event.target.value)}
                  />
                  <TextField
                    required
                    label="账户名称"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                  <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" label={otpType === 'hotp' ? 'HOTP' : 'TOTP'} />
                    <Chip size="small" label={algorithm} />
                    <Chip size="small" label={`${digits} 位`} />
                    <Chip size="small" label={otpType === 'hotp' ? `计数器 ${counter}` : `${period} 秒刷新`} />
                    <Button type="button" size="small" onClick={() => setInputMode('manual')}>编辑高级参数</Button>
                  </Box>
                </Box>
              )}
              <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2 }}>
                二维码等同于 2FA 密钥。复制或下载后，请避免发送给他人。
              </Alert>
            </Box>
          )}
          {!editingTarget && (
            <Box sx={{ mt: 2.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>分组</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  label="新建分组"
                  variant={importGroupMode === 'new' ? 'filled' : 'outlined'}
                  color={importGroupMode === 'new' ? 'primary' : 'default'}
                  onClick={() => setImportGroupMode('new')}
                />
                <Chip
                  label="加入现有分组"
                  variant={importGroupMode === 'existing' ? 'filled' : 'outlined'}
                  color={importGroupMode === 'existing' ? 'primary' : 'default'}
                  disabled={existingSources.length === 0}
                  onClick={() => {
                    setImportGroupMode('existing')
                    if (!importExistingSource && existingSources[0]) setImportExistingSource(existingSources[0])
                  }}
                />
              </Box>
              {importGroupMode === 'new' ? (
                <TextField
                  fullWidth
                  label="新分组名称"
                  value={importGroupName}
                  onChange={(event) => setImportGroupName(event.target.value)}
                  placeholder="例如：工作、旧手机"
                  helperText="不填则按服务商自动命名。新分组会排在最后，可在右侧边栏拖动调整。"
                  inputProps={{ maxLength: 80, 'aria-label': '新分组名称' }}
                />
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {existingSources.map((source) => (
                    <Chip
                      key={source}
                      size="small"
                      label={source}
                      variant={normalizeTotpSource(importExistingSource) === source ? 'filled' : 'outlined'}
                      onClick={() => setImportExistingSource(source)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={resetDialog} disabled={mutationBusy}>取消</Button>
          <Button type="submit" variant="contained" disabled={mutationBusy || qrImageBusy}>
            {mutationBusy ? '保存中...' : editingTarget ? '保存' : '添加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========== Saved QR Image Dialog ========== */}
      <Dialog
        open={qrViewerAccount !== null}
        onClose={closeQrViewer}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCode2Icon sx={{ color: 'success.main' }} />
          原始 2FA 二维码
        </DialogTitle>
        <DialogContent>
          {qrViewerBusy && <LinearProgress aria-label="正在读取二维码" sx={{ mb: 2 }} />}
          {qrViewerImage && (
            <Box>
              <Box
                sx={{
                  minHeight: 320,
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'border.subtle',
                  bgcolor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Box
                  component="img"
                  src={qrViewerImage.dataUrl}
                  alt={`${qrViewerAccount?.issuer || qrViewerAccount?.label || ''} 的原始二维码`}
                  sx={{ display: 'block', maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }}
                />
              </Box>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.25, lineHeight: 1.5 }}>
                {qrViewerImage.originalName} · {Math.max(1, Math.round(qrViewerImage.originalSize / 1024))} KB
              </Typography>
              <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1.5 }}>
                此图片可以重新绑定验证器，包含与密钥等价的敏感信息。
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            startIcon={qrCopied ? <CheckIcon /> : <ContentCopyIcon />}
            color={qrCopied ? 'success' : 'primary'}
            onClick={() => { void handleCopyQrImage() }}
            disabled={!qrViewerImage || qrActionBusy !== null}
          >
            {qrCopied ? '已复制' : qrActionBusy === 'copy' ? '复制中...' : '复制图片'}
          </Button>
          <Button
            type="button"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() => { void handleSaveQrImage() }}
            disabled={!qrViewerImage || qrActionBusy !== null}
          >
            {qrActionBusy === 'save' ? '保存中...' : '下载图片'}
          </Button>
          <Button
            type="button"
            color="inherit"
            onClick={closeQrViewer}
            disabled={qrActionBusy !== null}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========== Delete Confirmation Dialog ========== */}
      <Dialog open={deleteConfirmOpen} onClose={() => { if (!mutationBusy) setDeleteConfirmOpen(false) }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          确认删除
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            确定要删除以下 2FA 账户吗？
          </Typography>
          {deleteTarget && (
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 1, bgcolor: 'surface.raised', borderColor: 'border.subtle' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                {deleteTarget.issuer || deleteTarget.label}
              </Typography>
              {deleteTarget.issuer && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25, lineHeight: 1.35 }}>
                  {deleteTarget.label}
                </Typography>
              )}
            </Paper>
          )}
          <Typography variant="body2" sx={{ mt: 2, color: 'error.main', fontSize: '0.8rem' }}>
            ⚠️ 删除后将无法恢复，请确保你有其他方式访问此账户的双因素认证。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={mutationBusy}>取消</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={mutationBusy}>
            {mutationBusy ? '删除中...' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========== Migration Import Dialog ========== */}
      <Dialog
        open={migrationDialogOpen}
        onClose={() => { if (!mutationBusy) closeMigrationDialog() }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GoogleIcon sx={{ color: 'primary.main' }} />
          导入 Google Authenticator
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, lineHeight: 1.55 }}>
            将导入以下 {migrationEntries.length} 个验证器账户。二维码本身不含设备名，请为这批账户命名来源；导入后会单独成组，不会和现有账户混在一起。
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="来源名称"
            value={migrationSource}
            onChange={(event) => setMigrationSource(event.target.value)}
            placeholder="例如：旧手机、公司 Authenticator"
            helperText="同名来源会并入同一组；改名即可单独成组。"
            inputProps={{ maxLength: 80, 'aria-label': '来源名称' }}
            sx={{ mb: existingSources.length > 0 ? 1 : 2 }}
          />
          {existingSources.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
              {existingSources.map((source) => (
                <Chip
                  key={source}
                  size="small"
                  label={source}
                  variant={normalizeTotpSource(migrationSource) === source ? 'filled' : 'outlined'}
                  onClick={() => setMigrationSource(source)}
                />
              ))}
            </Box>
          )}
          <Box sx={{ maxHeight: 320, overflow: 'auto', pr: 0.5 }}>
            {migrationEntries.map((entry, index) => (
              <Paper
                key={`${entry.issuer}-${entry.label}-${index}`}
                variant="outlined"
                sx={{ p: 1.5, mb: 1, borderRadius: 1, bgcolor: 'surface.raised', borderColor: 'border.subtle' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                      {entry.issuer || entry.label}
                    </Typography>
                    {entry.issuer ? (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25, lineHeight: 1.35 }}>
                        {entry.label}
                      </Typography>
                    ) : null}
                  </Box>
                  <OtpTypeBadge type={entry.otpType} />
                </Box>
              </Paper>
            ))}
          </Box>
          {migrationSkippedCount > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {migrationSkippedCount} 个条目缺少有效密钥，已忽略
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={closeMigrationDialog} disabled={mutationBusy}>取消</Button>
          <Button
            type="button"
            variant="contained"
            onClick={() => { void handleMigrationImport() }}
            disabled={mutationBusy || migrationEntries.length === 0}
          >
            {mutationBusy ? '导入中...' : '导入全部'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={notice !== null} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={notice?.severity || 'success'} variant="filled" onClose={() => setNotice(null)} sx={{ width: '100%' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}
