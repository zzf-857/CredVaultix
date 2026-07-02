import React, { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, IconButton, Button, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Fade, LinearProgress, Chip, Paper,
  MenuItem, Select, FormControl, InputLabel,
  ToggleButton, ToggleButtonGroup,
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
import FlashOnIcon from '@mui/icons-material/FlashOn'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import GoogleIcon from '@mui/icons-material/Google'
import MicrosoftIcon from '@mui/icons-material/Microsoft'
import AppsIcon from '@mui/icons-material/Apps'
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
        bgcolor: isTotp ? 'rgba(141,220,159,0.12)' : 'rgba(173,198,255,0.12)',
        color: isTotp ? '#8ddc9f' : '#adc6ff',
        border: '1px solid',
        borderColor: isTotp ? 'rgba(141,220,159,0.3)' : 'rgba(173,198,255,0.3)',
        '& .MuiChip-icon': {
          color: 'inherit',
        },
      }}
    />
  )
}

function TotpCard({
  account,
  isPinned = false,
  onTogglePin,
  onRequestDelete,
  onIncrementCounter,
  onNavigateToAccount,
}: {
  account: TotpAccountRow
  isPinned?: boolean
  onTogglePin?: () => void
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
        p: 2.5,
        mb: 0,
        borderRadius: 3,
        border: '1px solid',
        borderColor: isPinned ? 'rgba(173, 198, 255, 0.45)' : 'divider',
        bgcolor: 'background.paper',
        boxShadow: 'none',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          borderColor: isPinned ? 'primary.main' : 'divider',
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
            bgcolor: isHotp ? 'rgba(173,198,255,0.12)' : 'rgba(141,220,159,0.12)',
            border: '1px solid',
            borderColor: isHotp ? 'rgba(173,198,255,0.28)' : 'rgba(141,220,159,0.28)',
            mr: 1.5,
            flexShrink: 0,
          }}
        >
          <SecurityIcon sx={{ fontSize: 20, color: isHotp ? '#adc6ff' : '#8ddc9f' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.9rem', color: isOrphaned ? 'text.secondary' : 'text.primary', textDecoration: isOrphaned ? 'line-through' : 'none' }} noWrap>
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

        <Box sx={{ display: 'flex', gap: 0.25, opacity: hovered ? 1 : 0.2, transition: 'opacity 0.15s' }}>
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
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': { bgcolor: 'action.selected' },
          transition: 'background-color 0.15s',
        }}
      >
        <Typography
          variant="h4"
          className="mono-data"
          sx={{
            fontWeight: 700,
            letterSpacing: 0,
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
            fontSize: '0.65rem',
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
  counter,
  onIncrementCounter,
}: {
  secret: string
  otpType: 'totp' | 'hotp'
  counter: number
  onIncrementCounter: () => void
}) {
  const [code, setCode] = useState('------')
  const [remaining, setRemaining] = useState(30)
  const [copied, setCopied] = useState(false)

  const isHotp = otpType === 'hotp'

  useEffect(() => {
    if (!secret || !secret.trim()) {
      setCode('------')
      return
    }

    const generate = () => {
      try {
        const cleanSecret = secret.replace(/\s/g, '').toUpperCase()
        const secretObj = OTPAuth.Secret.fromBase32(cleanSecret)
        
        if (isHotp) {
          const hotp = new OTPAuth.HOTP({
            algorithm: 'SHA1',
            digits: 6,
            counter: counter,
            secret: secretObj,
          })
          setCode(hotp.generate({ counter }))
          setRemaining(-1)
        } else {
          const totp = new OTPAuth.TOTP({
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: secretObj,
          })
          setCode(totp.generate())
          const now = Math.floor(Date.now() / 1000)
          setRemaining(30 - (now % 30))
        }
      } catch {
        setCode('------')
      }
    }

    generate()
    if (isHotp) return

    const timer = setInterval(generate, 1000)
    return () => clearInterval(timer)
  }, [secret, otpType, counter])

  const handleCopy = async () => {
    if (code === '------') return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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

  const progress = !isHotp ? (remaining / 30) * 100 : 100
  const isUrgent = !isHotp && remaining <= 5
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: isUrgent ? 'error.dark' : 'primary.main',
        bgcolor: 'background.default',
        transition: 'all 0.3s ease',
      }}
    >
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
          '&:hover': { bgcolor: 'action.selected' },
          transition: 'background-color 0.15s',
        }}
      >
        <Typography
          variant="h4"
          className="mono-data"
          sx={{
            fontWeight: 700,
            letterSpacing: 0,
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
                onClick={(e) => { e.stopPropagation(); onIncrementCounter() }}
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
            <IconButton size="small" sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
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
    accounts,
    loadTotpAccounts,
    loadAccounts,
    createTotpAccount,
    deleteTotpAccount,
    incrementTotpCounter,
    navigateToAccount,
    accountsPinnedIds,
    accountsCustomOrder,
  } = useStore()

  // Alignment state with localStorage persistence and safety check
  const [alignment, setAlignment] = useState<'left' | 'center'>(() => {
    try {
      const saved = localStorage.getItem('2fa_card_alignment')
      return (saved === 'left' || saved === 'center') ? saved : 'left'
    } catch {
      return 'left'
    }
  })

  const handleAlignmentChange = (newAlignment: 'left' | 'center') => {
    setAlignment(newAlignment)
    try {
      localStorage.setItem('2fa_card_alignment', newAlignment)
    } catch (e) {
      console.error('Failed to save 2fa card alignment:', e)
    }
  }

  const [activeGroup, setActiveGroup] = useState<string>('')
  const listContainerRef = useRef<HTMLDivElement>(null)

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



  useEffect(() => {
    if (googleAccounts.length > 0) {
      setActiveGroup('group-google')
    } else if (outlookAccounts.length > 0) {
      setActiveGroup('group-microsoft')
    } else if (otherAccounts.length > 0) {
      setActiveGroup('group-other')
    }
  }, [totpAccounts])

  const scrollToGroup = (groupId: string) => {
    const el = document.getElementById(groupId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveGroup(groupId)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const containerRect = container.getBoundingClientRect()
    
    const groups = [
      { id: 'group-google', el: document.getElementById('group-google') },
      { id: 'group-microsoft', el: document.getElementById('group-microsoft') },
      { id: 'group-other', el: document.getElementById('group-other') }
    ].filter(g => g.el !== null) as { id: string; el: HTMLElement }[]
    
    if (groups.length === 0) return
    
    let closestId = ''
    let minDiff = Infinity
    
    for (const group of groups) {
      const rect = group.el.getBoundingClientRect()
      const diff = Math.abs(rect.top - containerRect.top)
      if (diff < minDiff) {
        minDiff = diff
        closestId = group.id
      }
    }
    
    if (closestId && closestId !== activeGroup) {
      setActiveGroup(closestId)
    }
  }

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

  // Temporary generator states
  const [tempDialogOpen, setTempDialogOpen] = useState(false)
  const [tempInputMode, setTempInputMode] = useState<'manual' | 'uri'>('manual')
  const [tempOtpType, setTempOtpType] = useState<'totp' | 'hotp'>('totp')
  const [tempIssuer, setTempIssuer] = useState('')
  const [tempLabel, setTempLabel] = useState('')
  const [tempSecret, setTempSecret] = useState('')
  const [tempUri, setTempUri] = useState('')
  const [tempUriError, setTempUriError] = useState('')
  const [tempCounter, setTempCounter] = useState(0)

  const resetTempDialog = () => {
    setTempDialogOpen(false)
    setTempIssuer('')
    setTempLabel('')
    setTempSecret('')
    setTempUri('')
    setTempUriError('')
    setTempInputMode('manual')
    setTempOtpType('totp')
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
    setOtpType(tempOtpType)
    setInputMode(tempInputMode)
    setUri(tempUri)
    
    setTempDialogOpen(false)
    setDialogOpen(true)
  }

  useEffect(() => {
    loadTotpAccounts()
    loadAccounts()
  }, [])

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
  const googleAccounts = safeTotpAccounts.filter(acc => getAccountPlatform(acc) === 'google')
  const outlookAccounts = safeTotpAccounts.filter(acc => getAccountPlatform(acc) === 'microsoft')
  const otherAccounts = safeTotpAccounts.filter(acc => getAccountPlatform(acc) === 'other')

  const renderAccountGroup = (
    title: string,
    icon: React.ReactNode,
    color: string,
    bgColor: string,
    groupAccounts: TotpAccountRow[],
    groupId?: string
  ) => {
    if (groupAccounts.length === 0) return null

    // Sort accounts dynamically via the composite sorting engine (pinned first, then customOrder)
    const sortedAccounts = sortAccounts(groupAccounts)

    return (
      <Box id={groupId} sx={{ mb: 4 }}>
        {/* Section Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 0.5 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: bgColor,
              color: color,
            }}
          >
            {icon}
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
            {title}
          </Typography>
          <Chip
            label={`${groupAccounts.length} 个账户`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 500,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              ml: 1,
            }}
          />
        </Box>

        {/* Cards Grid */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2.5,
            width: '100%',
            justifyContent: alignment === 'center' ? 'center' : 'flex-start',
          }}
        >
          {sortedAccounts.map(account => (
            <Box
              key={account.id}
              sx={{
                width: {
                  xs: '100%',
                  sm: '100%',
                  md: 'calc(50% - 10px)',
                  lg: 'calc(50% - 10px)',
                  xl: 'calc(33.33% - 17px)',
                },
                minWidth: {
                  xs: '100%',
                  sm: 440,
                },
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <TotpCard
                account={account}
                isPinned={account.linked_account_id ? accountsPinnedIds.includes(account.linked_account_id) : false}
                onRequestDelete={handleRequestDelete}
                onIncrementCounter={incrementTotpCounter}
                onNavigateToAccount={navigateToAccount}
              />
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

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
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#201f1f' : '#f8fafd',
            border: '1px solid',
            borderColor: 'divider',
            color: 'primary.main',
          }}
        >
          <SecurityIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.2 }}>
            2FA 验证器
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {totpAccounts.length} 个验证账户
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={alignment}
            exclusive
            onChange={(e, newAlignment) => {
              if (newAlignment !== null) {
                handleAlignmentChange(newAlignment)
              }
            }}
            size="small"
            aria-label="text alignment"
            sx={{
              mr: 1,
              height: 30,
              '& .MuiToggleButton-root': {
                px: 1,
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
            <ToggleButton value="left" aria-label="left aligned" title="左对齐">
              <FormatAlignLeftIcon sx={{ fontSize: 16 }} />
            </ToggleButton>
            <ToggleButton value="center" aria-label="centered" title="居中对齐">
              <FormatAlignCenterIcon sx={{ fontSize: 16 }} />
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            size="small"
            startIcon={<FlashOnIcon />}
            onClick={() => setTempDialogOpen(true)}
            sx={{ height: 32 }}
          >
            临时验证器
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ height: 32 }}
          >
            添加账户
          </Button>
        </Box>
      </Box>

      {/* Account list Container with Relative Layout for Floating Sidebar */}
      <Box sx={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Account list */}
        <Box
          ref={listContainerRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2.5,
            pr: totpAccounts.length > 0 ? { xs: 2, md: 10 } : 2, // 预留右侧空间给侧边栏，防止卡片被遮挡
            transition: 'padding-right 0.2s ease',
          }}
        >
          {totpAccounts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 4, maxWidth: 460, mx: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
              <SecurityIcon sx={{ fontSize: 52, color: 'primary.main', opacity: 0.32, mb: 2 }} />
              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1, fontWeight: 800 }}>
                暂无 2FA 账户
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, fontSize: '0.8rem' }}>
                添加你的双因素认证账户，随时生成验证码
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button variant="outlined" startIcon={<FlashOnIcon />} onClick={() => setTempDialogOpen(true)}>
                  临时验证器
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                  添加第一个账户
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              {renderAccountGroup(
                'Google / Gmail 账户',
                <GoogleIcon sx={{ fontSize: 16 }} />,
              '#8ddc9f',
              'rgba(141,220,159,0.15)',
                googleAccounts,
                'group-google'
              )}
              {renderAccountGroup(
                'Microsoft / Outlook 账户',
                <MicrosoftIcon sx={{ fontSize: 16 }} />,
              '#adc6ff',
              'rgba(173,198,255,0.15)',
                outlookAccounts,
                'group-microsoft'
              )}
              {renderAccountGroup(
                '其他应用账户',
                <AppsIcon sx={{ fontSize: 16 }} />,
              '#c2c6d6',
              'rgba(194,198,214,0.12)',
                otherAccounts,
                'group-other'
              )}
            </Box>
          )}
        </Box>

        {/* Quick Navigation Floating Sidebar */}
        {totpAccounts.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              position: 'absolute',
              right: 24,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              p: 1,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
              transition: 'border-color 0.2s ease, background-color 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
              }
            }}
          >
            {googleAccounts.length > 0 && (
              <Tooltip title="Google / Gmail 分区" placement="left" arrow>
                <IconButton
                  onClick={() => scrollToGroup('group-google')}
                  sx={{
                    width: 44,
                    height: 44,
                    color: activeGroup === 'group-google' ? '#8ddc9f' : 'text.secondary',
                    bgcolor: activeGroup === 'group-google' ? 'rgba(141,220,159,0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeGroup === 'group-google' ? 'rgba(141,220,159,0.4)' : 'transparent',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
                    '&:hover': {
                      color: '#8ddc9f',
                      bgcolor: 'rgba(141,220,159,0.1)',
                    }
                  }}
                >
                  <GoogleIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            )}
            
            {outlookAccounts.length > 0 && (
              <Tooltip title="Microsoft / Outlook 分区" placement="left" arrow>
                <IconButton
                  onClick={() => scrollToGroup('group-microsoft')}
                  sx={{
                    width: 44,
                    height: 44,
                    color: activeGroup === 'group-microsoft' ? '#adc6ff' : 'text.secondary',
                    bgcolor: activeGroup === 'group-microsoft' ? 'rgba(173,198,255,0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeGroup === 'group-microsoft' ? 'rgba(173,198,255,0.4)' : 'transparent',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
                    '&:hover': {
                      color: '#adc6ff',
                      bgcolor: 'rgba(173,198,255,0.1)',
                    }
                  }}
                >
                  <MicrosoftIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            )}
            
            {otherAccounts.length > 0 && (
              <Tooltip title="其他应用分区" placement="left" arrow>
                <IconButton
                  onClick={() => scrollToGroup('group-other')}
                  sx={{
                    width: 44,
                    height: 44,
                    color: activeGroup === 'group-other' ? '#c2c6d6' : 'text.secondary',
                    bgcolor: activeGroup === 'group-other' ? 'rgba(194,198,214,0.12)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeGroup === 'group-other' ? 'rgba(194,198,214,0.28)' : 'transparent',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
                    '&:hover': {
                      color: '#c2c6d6',
                      bgcolor: 'rgba(194,198,214,0.08)',
                    }
                  }}
                >
                  <AppsIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            )}
          </Paper>
        )}
      </Box>

      {/* ========== Temporary Authenticator Dialog ========== */}
      <Dialog open={tempDialogOpen} onClose={resetTempDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlashOnIcon sx={{ color: 'primary.main' }} />
          临时验证器 (内存计算，不保存)
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            在这里，你可以快速生成一次性的 2FA 验证码。数据完全保留在内存中，关闭弹窗或重启软件后即被销毁，绝不写入数据库。
          </Typography>

          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
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
                onChange={(e) => setTempSecret(e.target.value)}
                placeholder="如: JBSWY3DPEHPK3PXP"
                helperText="通常是一串大写字母和数字的组合"
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
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              实时生成验证码
            </Typography>
            <TempTotpDisplay
              secret={tempSecret}
              otpType={tempOtpType}
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
      <Dialog open={dialogOpen} onClose={resetDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon sx={{ color: 'primary.main' }} />
          添加 2FA 账户
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
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
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', borderColor: 'divider' }}>
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
