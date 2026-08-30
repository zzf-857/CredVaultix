import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProviderAutocomplete from './ProviderAutocomplete'
import providerAutocompleteSource from './ProviderAutocomplete.tsx?raw'

describe('ProviderAutocomplete', () => {
  it('renders as a controlled provider search input', () => {
    const html = renderToStaticMarkup(React.createElement(ProviderAutocomplete, {
      value: null,
      inputValue: '',
      onChange: () => undefined,
      onInputChange: () => undefined,
    }))

    expect(html).toContain('模型厂商')
    expect(html).toContain('搜索厂商名称、别名或域名')
    expect(html).toContain('role="combobox"')
  })

  it('delegates all value state to its caller and uses the shared catalog filter', () => {
    expect(providerAutocompleteSource).toContain('freeSolo')
    expect(providerAutocompleteSource).toContain('searchModelProviders(state.inputValue, availableOptions)')
    expect(providerAutocompleteSource).toContain('<ProviderIcon provider={option}')
    expect(providerAutocompleteSource).not.toContain('useState(')
    expect(providerAutocompleteSource).not.toContain('useEffect(')
  })
})
