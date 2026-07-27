import { describe, expect, it } from 'vitest'
import { shouldSubmitOnEnter, type QuickSubmitEventLike } from './quickSubmit'

const event = (patch: Partial<QuickSubmitEventLike> = {}): QuickSubmitEventLike => ({
  key: 'Enter',
  target: { tagName: 'INPUT' },
  nativeEvent: { isComposing: false },
  ...patch,
})

describe('shouldSubmitOnEnter', () => {
  it('accepts a plain Enter from a single-line input', () => {
    expect(shouldSubmitOnEnter(event())).toBe(true)
  })

  it('ignores IME composition and modified Enter presses', () => {
    expect(shouldSubmitOnEnter(event({ nativeEvent: { isComposing: true } }))).toBe(false)
    expect(shouldSubmitOnEnter(event({ shiftKey: true }))).toBe(false)
    expect(shouldSubmitOnEnter(event({ ctrlKey: true }))).toBe(false)
  })

  it('keeps textarea and rich-text Enter behavior', () => {
    expect(shouldSubmitOnEnter(event({ target: { tagName: 'TEXTAREA' } }))).toBe(false)
    expect(shouldSubmitOnEnter(event({ target: { tagName: 'DIV', isContentEditable: true } }))).toBe(false)
  })

  it('lets comboboxes consume Enter to confirm their own option', () => {
    expect(shouldSubmitOnEnter(event({
      target: { tagName: 'INPUT', getAttribute: (name) => name === 'role' ? 'combobox' : null },
    }))).toBe(false)
    expect(shouldSubmitOnEnter(event({
      target: {
        tagName: 'INPUT',
        closest: (selector) => selector === '[role="combobox"]' ? {} : null,
      },
    }))).toBe(false)
  })

  it('leaves button and select activation to the focused control', () => {
    expect(shouldSubmitOnEnter(event({ target: { tagName: 'BUTTON' } }))).toBe(false)
    expect(shouldSubmitOnEnter(event({ target: { tagName: 'SELECT' } }))).toBe(false)
    expect(shouldSubmitOnEnter(event({
      target: { tagName: 'DIV', getAttribute: (name) => name === 'role' ? 'button' : null },
    }))).toBe(false)
    expect(shouldSubmitOnEnter(event({
      target: { tagName: 'INPUT', getAttribute: (name) => name === 'type' ? 'submit' : null },
    }))).toBe(false)
    expect(shouldSubmitOnEnter(event({
      target: { tagName: 'INPUT', getAttribute: (name) => name === 'type' ? 'checkbox' : null },
    }))).toBe(false)
    expect(shouldSubmitOnEnter(event({
      target: {
        tagName: 'SPAN',
        closest: (selector) => selector === 'button, [role="button"]' ? {} : null,
      },
    }))).toBe(false)
  })
})
