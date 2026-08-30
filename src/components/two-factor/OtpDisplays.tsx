import { useState } from 'react'
import {
  Box,
  Chip,
  Fade,
  IconButton,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LinkIcon from '@mui/icons-material/Link'
import PinIcon from '@mui/icons-material/Pin'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import RefreshIcon from '@mui/icons-material/Refresh'
import SecurityIcon from '@mui/icons-material/Security'
import TimerIcon from '@mui/icons-material/Timer'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import useCopyFeedback from '../../hooks/useCopyFeedback'
import { useOtpSnapshot } from '../../hooks/useOtpSnapshot'
import type { TotpAccountRow } from '../../types'
import { isUndecryptedValue } from '../../utils/decryptionHealth'

export function OtpTypeBadge({ type }: { type: string }) {
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
export function TotpCard({
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
  const otp = useOtpSnapshot({
    secret: account.secret,
    otpType: account.otp_type,
    algorithm: account.algorithm,
    digits: account.digits,
    period: account.period,
    counter: account.counter,
    issuer: account.issuer,
    label: account.label,
  })
  const { copiedKey, copy } = useCopyFeedback()
  const copyKey = `card-code:${otp.code}`
  const copied = copiedKey === copyKey
  const [showSecret, setShowSecret] = useState(false)

  const { isHotp, remaining, progress, urgent: isUrgent } = otp
  const secretUndecryptable = isUndecryptedValue(account.secret)
  const linkedAccountState = account.linked_account_state
    || (account.linked_account_id?.startsWith('!deleted-') ? 'missing' : account.linked_account_id ? 'active' : 'unlinked')
  const isOrphaned = linkedAccountState === 'missing'
  const isLinkedAccountTrashed = linkedAccountState === 'trashed'

  const handleCopy = async () => {
    return copy(otp.code, copyKey)
  }

  const formattedCode = otp.code.length === 6
    ? `${otp.code.slice(0, 3)} ${otp.code.slice(3)}`
    : otp.code

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
          aria-label={`复制验证码 ${otp.code}`}
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
              fontSize: otp.code.length > 6 ? '1.4rem' : '1.65rem',
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

export function TempTotpDisplay({
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
  const otp = useOtpSnapshot({ secret, otpType, algorithm, digits, period, counter })
  const { code, failed: codeFailed, isHotp, remaining, progress, urgent: isUrgent } = otp
  const { copiedKey, copy } = useCopyFeedback()
  const copyKey = `temporary-code:${code}`
  const copied = copiedKey === copyKey

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

  if (codeFailed) {
    return (
      <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center', py: 2 }}>
        ⚠️ 密钥格式不正确，必须是合法的 Base32 编码（A-Z, 2-7）
      </Typography>
    )
  }

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
