import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createTheme, ThemeProvider } from '@mui/material'
import { describe, expect, it } from 'vitest'
import PlatformIcon from './PlatformIcon'
import { PLATFORM_ICON_ASSETS } from './platformIcons'

describe('PlatformIcon', () => {
  it('renders the bundled full-color platform asset as a decorative image', () => {
    const html = renderToStaticMarkup(React.createElement(PlatformIcon, {
      platform: 'google',
      size: 24,
      className: 'platform-icon',
    }))

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-platform-icon="google"')
    expect(html).toContain('<img')
    expect(html).toContain('alt=""')
    expect(html).toContain('width:24px')
    expect(html).toContain('platform-icon')
  })

  it.each(['light', 'dark'] as const)('adapts monochrome icons to %s theme text instead of fixed white', (mode) => {
    const theme = createTheme({ palette: { mode, text: { primary: mode === 'light' ? '#123456' : '#abcdef' } } })
    const html = renderToStaticMarkup(React.createElement(ThemeProvider, { theme },
      React.createElement(PlatformIcon, { name: 'GitHub' })))

    expect(html).toContain(`color:${theme.palette.text.primary}`)
    expect(html).toContain('background-color:currentColor')
    expect(html).toContain('mask-image:')
    expect(html).toContain(PLATFORM_ICON_ASSETS.github!.icon)
    expect(html).not.toContain('<img')
    expect(html).toContain('aria-hidden="true"')
  })

  it('uses recognizable generic icons for custom tags and other accounts', () => {
    const tag = renderToStaticMarkup(React.createElement(PlatformIcon, { name: '私人内网' }))
    const account = renderToStaticMarkup(React.createElement(PlatformIcon, { platform: 'other' }))

    expect(tag).toContain('LabelOutlinedIcon')
    expect(tag).toContain('data-platform-icon="custom"')
    expect(account).toContain('AccountCircleOutlinedIcon')
    expect(account).toContain('data-platform-icon="other"')
  })

  it('identifies supported registered-platform names without changing their labels', () => {
    const html = renderToStaticMarkup(React.createElement(PlatformIcon, { name: 'QQ' }))
    expect(html).toContain('data-platform-icon="qq"')
    expect(html).toContain(PLATFORM_ICON_ASSETS.qq!.icon)
    expect(html).not.toContain('aria-label=')
  })
})
