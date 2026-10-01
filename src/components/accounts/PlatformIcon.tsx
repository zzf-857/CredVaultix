import React from 'react'
import { Box } from '@mui/material'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import YouTubeIcon from '@mui/icons-material/YouTube'
import type { AccountPlatform } from '../../utils/accountPlatform'
import { getPlatformIconKey, PLATFORM_ICON_ASSETS } from './platformIcons'

export interface PlatformIconProps {
  platform?: AccountPlatform
  name?: string
  size?: number
  className?: string
}

export default function PlatformIcon({ platform, name, size = 20, className }: PlatformIconProps) {
  const key = platform && platform !== 'other' ? platform : getPlatformIconKey(name)
  const asset = key ? PLATFORM_ICON_ASSETS[key] : undefined
  const isAccount = platform !== undefined

  return (
    <Box
      component="span"
      className={className}
      aria-hidden="true"
      data-platform-icon={key || (isAccount ? 'other' : 'custom')}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-grid',
        placeItems: 'center',
        verticalAlign: 'middle',
        color: 'text.primary',
        ...(asset?.monochrome ? {
          bgcolor: 'currentColor',
          maskImage: `url("${asset.icon}")`,
          WebkitMaskImage: `url("${asset.icon}")`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        } : {}),
      }}
    >
      {asset && !asset.monochrome ? (
        <Box component="img" src={asset.icon} alt="" sx={{ width: size, height: size, display: 'block', objectFit: 'contain' }} />
      ) : !asset ? (
        key === 'youtube'
          ? <YouTubeIcon sx={{ fontSize: size, color: '#ff0000' }} />
          : isAccount
            ? <AccountCircleOutlinedIcon sx={{ fontSize: size }} />
            : <LabelOutlinedIcon sx={{ fontSize: size }} />
      ) : null}
    </Box>
  )
}
