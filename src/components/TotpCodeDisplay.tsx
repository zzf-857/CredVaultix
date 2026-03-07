import React, { useState, useEffect } from 'react'
import { Box, Typography, LinearProgress, IconButton, Tooltip, Fade } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import * as OTPAuth from 'otpauth'

/**
 * Shared inline TOTP code display component.
 * Used in both AccountDetail (inline) and TwoFactorPanel (card) views.
 */
export default function TotpCodeDisplay({
  secret,
  compact = false,
}: {
  secret: string
  compact?: boolean
}) {
  const [code, setCode] = useState('------')
  const [remaining, setRemaining] = useState(30)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!secret || !secret.trim()) return

    const generate = () => {
      try {
        const totp = new OTPAuth.TOTP({
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, '').toUpperCase()),
        })
        setCode(totp.generate())
        const now = Math.floor(Date.now() / 1000)
        setRemaining(30 - (now % 30))
      } catch {
        setCode('------')
        setRemaining(0)
      }
    }

    generate()
    const timer = setInterval(generate, 1000)
    return () => clearInterval(timer)
  }, [secret])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!secret || !secret.trim()) return null

  const progress = (remaining / 30) * 100
  const isUrgent = remaining <= 5
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code

  if (compact) {
    return (
      <Box
        onClick={handleCopy}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          py: 0.75,
          px: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: isUrgent ? 'error.dark' : 'divider',
          bgcolor: 'background.default',
          '&:hover': { bgcolor: 'action.selected' },
          transition: 'all 0.2s',
        }}
      >
        <Typography
          sx={{
            fontFamily: "'Inter', monospace",
            fontWeight: 700,
            letterSpacing: '0.12em',
            fontSize: '1.25rem',
            color: isUrgent ? 'error.main' : 'primary.main',
            flex: 1,
            transition: 'color 0.3s',
          }}
        >
          {formattedCode}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: isUrgent ? 'error.main' : 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
            minWidth: 18,
          }}
        >
          {remaining}s
        </Typography>
        <Tooltip title={copied ? '已复制!' : '复制验证码'} arrow TransitionComponent={Fade}>
          <IconButton size="small" sx={{ color: copied ? 'success.main' : 'text.secondary', p: 0.25 }}>
            {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
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
      </Box>
    )
  }

  // Full-size display (for standalone use)
  return (
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
        position: 'relative',
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
      <Tooltip title={copied ? '已复制!' : '点击复制'} arrow TransitionComponent={Fade}>
        <IconButton size="small" sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
          {copied ? <CheckIcon sx={{ fontSize: 18 }} /> : <ContentCopyIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}
