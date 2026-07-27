import React, { useState, useEffect } from 'react'
import { Box, Typography, LinearProgress, IconButton, Tooltip, Fade } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import RefreshIcon from '@mui/icons-material/Refresh'
import * as OTPAuth from 'otpauth'

/**
 * Shared inline TOTP code display component.
 * Used in both AccountDetail (inline) and TwoFactorPanel (card) views.
 */
export default function TotpCodeDisplay({
  secret,
  compact = false,
  algorithm = 'SHA1',
  digits = 6,
  period = 30,
  otpType = 'totp',
  counter = 0,
  onIncrementCounter,
  incrementBusy = false,
}: {
  secret: string
  compact?: boolean
  algorithm?: string
  digits?: number
  period?: number
  otpType?: string
  counter?: number
  onIncrementCounter?: () => void
  incrementBusy?: boolean
}) {
  const [code, setCode] = useState('-'.repeat(digits))
  const [remaining, setRemaining] = useState(period)
  const [copied, setCopied] = useState(false)
  const isHotp = otpType === 'hotp'

  useEffect(() => {
    if (!secret || !secret.trim()) {
      setCode('-'.repeat(digits))
      return
    }

    const generate = () => {
      try {
        const secretValue = OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '').toUpperCase())
        if (isHotp) {
          const hotp = new OTPAuth.HOTP({ algorithm, digits, counter, secret: secretValue })
          setCode(hotp.generate({ counter }))
          setRemaining(-1)
        } else {
          const totp = new OTPAuth.TOTP({ algorithm, digits, period, secret: secretValue })
          setCode(totp.generate())
          const now = Math.floor(Date.now() / 1000)
          setRemaining(period - (now % period))
        }
      } catch {
        setCode('-'.repeat(digits))
        setRemaining(0)
      }
    }

    generate()
    if (isHotp) return
    const timer = setInterval(generate, 1000)
    return () => clearInterval(timer)
  }, [algorithm, counter, digits, isHotp, period, secret])

  const handleCopy = async () => {
    if (/^-+$/.test(code)) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!secret || !secret.trim()) return null

  const progress = isHotp ? 100 : (remaining / period) * 100
  const isUrgent = !isHotp && remaining <= 5
  const splitAt = Math.ceil(code.length / 2)
  const formattedCode = code.length >= 6 ? `${code.slice(0, splitAt)} ${code.slice(splitAt)}` : code

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.75,
          px: 1.5,
          borderRadius: 1,
          border: '1px solid',
          borderColor: isUrgent ? 'error.dark' : 'border.subtle',
          bgcolor: 'surface.sunken',
          '&:hover': { bgcolor: 'surface.elevated' },
          transition: 'background-color 0.2s, border-color 0.2s',
          position: 'relative',
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
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          <Typography
            className="mono-data"
            sx={{
              minWidth: 0,
              fontWeight: 700,
              letterSpacing: 0,
              fontSize: code.length > 6 ? '1.1rem' : '1.25rem',
              whiteSpace: 'nowrap',
              color: isUrgent ? 'error.main' : 'primary.main',
              transition: 'color 0.3s',
            }}
          >
            {formattedCode}
          </Typography>
        </Box>
        {isHotp ? (
          <Tooltip title="生成下一个验证码" arrow TransitionComponent={Fade}>
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation()
                onIncrementCounter?.()
              }}
              disabled={incrementBusy}
              aria-label="生成下一个验证码"
              sx={{ color: 'primary.main', p: 0.25 }}
            >
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography
            variant="caption"
            sx={{ color: isUrgent ? 'error.main' : 'text.secondary', fontWeight: 600, fontSize: '0.75rem', minWidth: 18 }}
          >
            {remaining}s
          </Typography>
        )}
        <Tooltip title={copied ? '已复制!' : '复制验证码'} arrow TransitionComponent={Fade}>
          <IconButton
            size="small"
            aria-label={copied ? '验证码已复制' : '复制验证码'}
            onClick={(event) => { event.stopPropagation(); void handleCopy() }}
            sx={{ color: copied ? 'success.main' : 'text.secondary', p: 0.25 }}
          >
            {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
        {!isHotp && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              borderRadius: '0 0 8px 8px',
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': {
                bgcolor: isUrgent ? 'error.main' : 'primary.main',
                transition: 'width 1s linear',
              },
            }}
          />
        )}
      </Box>
    )
  }

  // Full-size display (for standalone use)
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: isUrgent ? 'error.dark' : 'border.subtle',
        bgcolor: 'surface.sunken',
        '&:hover': { bgcolor: 'surface.elevated' },
        transition: 'background-color 0.15s',
        position: 'relative',
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
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        <Typography
          variant="h4"
          className="mono-data"
          sx={{
            minWidth: 0,
            fontWeight: 700,
            letterSpacing: 0,
            fontSize: code.length > 6 ? '1.5rem' : '1.75rem',
            whiteSpace: 'nowrap',
            color: isUrgent ? 'error.main' : 'primary.main',
            transition: 'color 0.3s',
          }}
        >
          {formattedCode}
        </Typography>
      </Box>
      {isHotp ? (
        <Tooltip title="生成下一个验证码" arrow TransitionComponent={Fade}>
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onIncrementCounter?.()
            }}
            disabled={incrementBusy}
            aria-label="生成下一个验证码"
            sx={{ color: 'primary.main' }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      ) : (
        <Typography
          variant="caption"
          sx={{ color: isUrgent ? 'error.main' : 'text.secondary', fontWeight: 600, fontSize: '0.8rem', minWidth: 20, textAlign: 'right' }}
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
  )
}
