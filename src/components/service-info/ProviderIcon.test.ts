import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProviderIcon from './ProviderIcon'
import { getModelProviderById } from './modelProviders'

describe('ProviderIcon', () => {
  it('renders a bundled provider asset with an optional accessible label', () => {
    const html = renderToStaticMarkup(React.createElement(ProviderIcon, {
      provider: getModelProviderById('openai'),
      decorative: false,
      size: 36,
    }))

    expect(html).toContain('aria-label="OpenAI图标"')
    expect(html).toContain('<img')
    expect(html).toContain('width:36px')
    expect(html).toContain('height:36px')
  })

  it('uses the generic API icon when a provider has no bundled brand asset', () => {
    const html = renderToStaticMarkup(React.createElement(ProviderIcon, {
      providerId: 'custom',
      decorative: false,
    }))

    expect(html).toContain('aria-label="自定义厂商图标"')
    expect(html).toContain('<svg')
    expect(html).not.toContain('<img')
  })
})
