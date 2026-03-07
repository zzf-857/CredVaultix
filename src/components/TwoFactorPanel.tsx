import React, { useState, useEffect } from 'react'
import {
  Box, Typography, IconButton, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Fade, LinearProgress, Chip, Paper,
  MenuItem, Select, FormControl, InputLabel,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
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
import * as OTPAuth from 'otpauth'
import { useStore } from '../stores/useStore'
import { TotpAccountRow } from '../types'

interface OtpCode {
  code: string
  remaining: number
  period: number
}

function generateOtpCode(account: TotpAccountRow): OtpCode {
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
      const code = totp.generate()
      const now = Math.floor(Date.now() / 1000)
      const remaining = account.period - (now % account.period)
      return { code, remaining, period: account.period }
    }
  } catch {
    return { code: '------', remaining: 0, period: 30 }
  }
}

function parseOtpAuthUri(uri: string): { issuer: string; label: string; secret: string; algorithm: string; digits: number; period: number; otpType: string; counter: number } | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'otpauth:') return null

    const otpType = url.hostname // 'totp' or 'hotp'
    if (otpType !== 'totp' && otpType !== 'hotp') return null

    const path = decodeURIComponent(url.pathname.slice(1))
    const secret = url.searchParams.get('secret') || ''
    const issuer = url.searchParams.get('issuer') || ''
    const algorithm = url.searchParams.get('algorithm') || 'SHA1'
    const digits = parseInt(url.searchParams.get('digits') || '6')
    const period = parseInt(url.searchParams.get('period') || '30')
    const counter = parseInt(url.searchParams.get('counter') || '0')

    const label = path.includes(':') ? path.split(':').slice(1).join(':') : path

    return {
      issuer: issuer || (path.includes(':') ? path.split(':')[0] : ''),
      label, secret, algorithm, digits, period, otpType, counter,
    }
  } catch {
    return null
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
        height: 22,
        fontSize: '0.65rem',
        fontWeight: 600,
        bgcolor: isTotp ? 'rgba(129,201,149,0.12)' : 'rgba(168,199,250,0.12)',
        color: isTotp ? '#81c995' : '#a8c7fa',
        border: '1px solid',
        borderColor: isTotp ? 'rgba(129,201,149,0.3)' : 'rgba(168,199,250,0.3)',
        '& .MuiChip-icon': {
          color: 'inherit',
        },
      }}
    />
  )
}

function TotpCard({
  account,
  onRequestDelete,
  onIncrementCounter,
  onNavigateToAccount,
}: {
  account: TotpAccountRow
  onRequestDelete: (account: TotpAccountRow) => void
  onIncrementCounter: (id: string) => void
  onNavigateToAccount?: (accountId: string) => void
}) {
  const [otpCode, setOtpCode] = useState<OtpCode>(() => generateOtpCode(account))
  const [copied, setCopied] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [hovered, setHovered] = useState(false)

  const isHotp = account.otp_type === 'hotp'
  const isOrphaned = account.linked_account_id?.startsWith('!deleted-')

  useEffect(() => {
    if (isHotp) {
      setOtpCode(generateOtpCode(account))
      return
    }
    const timer = setInterval(() => {
      setOtpCode(generateOtpCode(account))
    }, 1000)
    return () => clearInterval(timer)
  }, [account, isHotp])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(otpCode.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const progress = !isHotp ? (otpCode.remaining / otpCode.period) * 100 : 100
  const isUrgent = !isHotp && otpCode.remaining <= 5

  const formattedCode = otpCode.code.length === 6
    ? `${otpCode.code.slice(0, 3)} ${otpCode.code.slice(3)}`
    : otpCode.code

  return (
    <Paper
      elevation={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'primary.dark',
          bgcolor: 'action.hover',
        },
      }}
    >
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isHotp
              ? 'linear-gradient(135deg, rgba(168,199,250,0.2) 0%, rgba(168,199,250,0.1) 100%)'
              : 'linear-gradient(135deg, rgba(129,201,149,0.2) 0%, rgba(129,201,149,0.1) 100%)',
            mr: 1.5,
            flexShrink: 0,
          }}
        >
          <SecurityIcon sx={{ fontSize: 20, color: isHotp ? '#a8c7fa' : '#81c995' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', color: isOrphaned ? 'text.secondary' : 'text.primary', textDecoration: isOrphaned ? 'line-through' : 'none' }} noWrap>
              {account.issuer || account.label}
            </Typography>
            <OtpTypeBadge type={account.otp_type} />
            {isOrphaned ? (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
                label="主账号已删"
                size="small"
                sx={{
                  height: 22, fontSize: '0.65rem', fontWeight: 600,
                  bgcolor: 'rgba(211,47,47,0.1)', color: 'error.main', border: '1px solid', borderColor: 'rgba(211,47,47,0.3)',
                }}
              />
            ) : account.linked_account_id && (
              <Tooltip title="已关联账号 · 点击跳转" arrow TransitionComponent={Fade}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onNavigateToAccount?.(account.linked_account_id!) }}
                  sx={{ p: 0.25, color: '#a8c7fa', '&:hover': { color: 'primary.main' } }}
                >
                  <LinkIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {account.issuer && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }} noWrap>
              {account.label}
              {isHotp && ` · 计数器: ${account.counter}`}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.25, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
          <IconButton
            size="small"
            onClick={() => setShowSecret(!showSecret)}
            sx={{ color: 'text.secondary' }}
          >
            {showSecret ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          <IconButton
            size="small"
            onClick={() => onRequestDelete(account)}
            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Code display */}
      <Box
        onClick={handleCopy}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          py: 1,
          px: 1.5,
          borderRadius: 2,
          bgcolor: 'background.default',
          '&:hover': { bgcolor: 'action.selected' },
          transition: 'background-color 0.15s',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontFamily: "'Inter', monospace",
            fontWeight: 700,
            letterSpacing: '0.12em',
            fontSize: '1.75rem',
            color: isUrgent ? 'error.main' : 'primary.main',
            flex: 1,
            transition: 'color 0.3s',
          }}
        >
          {formattedCode}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isHotp ? (
            <Tooltip title="生成下一个验证码" arrow TransitionComponent={Fade}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onIncrementCounter(account.id) }}
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
              {otpCode.remaining}s
            </Typography>
          )}

          <Tooltip title={copied ? '已复制!' : '点击复制'} arrow TransitionComponent={Fade}>
            <IconButton size="small" sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
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
            mt: 1,
            display: 'block',
            color: 'text.secondary',
            fontFamily: 'monospace',
            fontSize: '0.65rem',
            wordBreak: 'break-all',
          }}
        >
          密钥: {account.secret}
        </Typography>
      )}
    </Paper>
  )
}

export default function TwoFactorPanel() {
  const { totpAccounts, loadTotpAccounts, createTotpAccount, deleteTotpAccount, incrementTotpCounter, navigateToAccount } = useStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inputMode, setInputMode] = useState<'manual' | 'uri'>('manual')
  const [otpType, setOtpType] = useState<'totp' | 'hotp'>('totp')
  const [issuer, setIssuer] = useState('')
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState('')
  const [uri, setUri] = useState('')
  const [uriError, setUriError] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<TotpAccountRow | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    loadTotpAccounts()
  }, [])

  const handleAdd = async () => {
    if (inputMode === 'uri') {
      const parsed = parseOtpAuthUri(uri.trim())
      if (!parsed) {
        setUriError('无效的 otpauth URI')
        return
      }
      await createTotpAccount(parsed.issuer, parsed.label, parsed.secret, parsed.otpType)
    } else {
      if (!label.trim() || !secret.trim()) return
      await createTotpAccount(issuer.trim(), label.trim(), secret.trim().replace(/\s/g, ''), otpType)
    }
    resetDialog()
  }

  const resetDialog = () => {
    setDialogOpen(false)
    setIssuer('')
    setLabel('')
    setSecret('')
    setUri('')
    setUriError('')
    setInputMode('manual')
    setOtpType('totp')
  }

  const handleRequestDelete = (account: TotpAccountRow) => {
    setDeleteTarget(account)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteTotpAccount(deleteTarget.id)
    }
    setDeleteTarget(null)
    setDeleteConfirmOpen(false)
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <SecurityIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', flex: 1 }}>
          2FA 验证器
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          添加账户
        </Button>
      </Box>

      {/* Account list */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {totpAccounts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.4, mb: 2 }} />
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
              暂无 2FA 账户
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontSize: '0.8rem' }}>
              添加你的双因素认证账户，随时生成验证码
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              添加第一个账户
            </Button>
          </Box>
        ) : (
          <Box sx={{ maxWidth: 480 }}>
            {totpAccounts.map(account => (
              <TotpCard
                key={account.id}
                account={account}
                onRequestDelete={handleRequestDelete}
                onIncrementCounter={incrementTotpCounter}
                onNavigateToAccount={navigateToAccount}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ========== Add Account Dialog ========== */}
      <Dialog open={dialogOpen} onClose={resetDialog} maxWidth="sm" fullWidth>
        <DialogTitle>添加 2FA 账户</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, mt: 1, display: 'flex', gap: 1 }}>
            <Chip
              label="手动输入"
              variant={inputMode === 'manual' ? 'filled' : 'outlined'}
              onClick={() => setInputMode('manual')}
              color={inputMode === 'manual' ? 'primary' : 'default'}
            />
            <Chip
              label="粘贴 URI"
              variant={inputMode === 'uri' ? 'filled' : 'outlined'}
              onClick={() => setInputMode('uri')}
              color={inputMode === 'uri' ? 'primary' : 'default'}
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TimerIcon sx={{ fontSize: 18, color: '#81c995' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>基于时间 (TOTP)</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>每 30 秒自动刷新验证码</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="hotp">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PinIcon sx={{ fontSize: 18, color: '#a8c7fa' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>基于计数器 (HOTP)</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>手动点击生成下一个验证码</Typography>
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
                onChange={(e) => setSecret(e.target.value)}
                placeholder="如: JBSWY3DPEHPK3PXP"
                helperText="通常是一串大写字母和数字的组合"
              />
            </>
          ) : (
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
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={resetDialog}>取消</Button>
          <Button variant="contained" onClick={handleAdd}>添加</Button>
        </DialogActions>
      </Dialog>

      {/* ========== Delete Confirmation Dialog ========== */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: 'warning.main' }} />
          确认删除
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            确定要删除以下 2FA 账户吗？
          </Typography>
          {deleteTarget && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {deleteTarget.issuer || deleteTarget.label}
              </Typography>
              {deleteTarget.issuer && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
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
          <Button onClick={() => setDeleteConfirmOpen(false)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>确认删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
