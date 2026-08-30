import { describe, expect, it } from 'vitest'
import {
  MODEL_PROVIDERS,
  getModelProviderById,
  getProviderHostname,
  normalizeProviderSearchText,
  providerMatchesQuery,
  searchModelProviders,
} from './modelProviders'

describe('model provider catalog', () => {
  it('keeps 20 built-in providers plus one explicit custom option with stable metadata', () => {
    expect(MODEL_PROVIDERS).toHaveLength(21)
    expect(new Set(MODEL_PROVIDERS.map((provider) => provider.id)).size).toBe(MODEL_PROVIDERS.length)

    for (const provider of MODEL_PROVIDERS) {
      expect(provider.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(provider.name.trim()).not.toBe('')
      expect(provider.aliases.length).toBeGreaterThan(0)

      if (provider.id !== 'custom') {
        expect(provider.baseUrl).toMatch(/^https?:\/\//)
        expect(provider.consoleUrl).toMatch(/^https?:\/\//)
        expect(provider.icon).toBeTruthy()
      }
    }

    expect(getModelProviderById('custom')).toMatchObject({
      name: '自定义厂商',
      baseUrl: '',
      consoleUrl: '',
      icon: null,
    })
  })

  it('finds providers by English names, Chinese aliases and normalized casing', () => {
    expect(searchModelProviders('OPENAI').map((provider) => provider.id)).toContain('openai')
    expect(searchModelProviders('ＤＥＥＰＳＥＥＫ').map((provider) => provider.id)).toContain('deepseek')
    expect(searchModelProviders('深度求索').map((provider) => provider.id)).toEqual(['deepseek'])
    expect(searchModelProviders('通义千问').map((provider) => provider.id)).toEqual(['alibaba-bailian'])
    expect(searchModelProviders('月之暗面').map((provider) => provider.id)).toEqual(['moonshot-ai'])
    expect(searchModelProviders('google ai').map((provider) => provider.id)).toContain('google-gemini')
  })

  it('finds providers by API or console domains without case sensitivity', () => {
    expect(searchModelProviders('API.OPENAI.COM').map((provider) => provider.id)).toEqual(['openai'])
    expect(searchModelProviders('BIGMODEL.CN').map((provider) => provider.id)).toEqual(['zhipu-ai'])
    expect(searchModelProviders('127.0.0.1:1234').map((provider) => provider.id)).toEqual(['lm-studio'])
    expect(searchModelProviders('console.volcengine.com').map((provider) => provider.id)).toEqual(['volcengine-ark'])
  })

  it('requires every whitespace-separated query token to match one provider', () => {
    const gemini = getModelProviderById('google-gemini')

    expect(gemini && providerMatchesQuery(gemini, 'google studio')).toBe(true)
    expect(gemini && providerMatchesQuery(gemini, 'google deepseek')).toBe(false)
    expect(searchModelProviders('not-a-provider')).toEqual([])
  })

  it('normalizes search text and extracts remote and local host names', () => {
    expect(normalizeProviderSearchText('  ＬＭ   STUDIO  ')).toBe('lm studio')
    expect(getProviderHostname('https://API.OpenAI.com/v1')).toBe('api.openai.com')
    expect(getProviderHostname('http://127.0.0.1:11434/v1')).toBe('127.0.0.1:11434')
    expect(getProviderHostname('')).toBe('')
  })
})
