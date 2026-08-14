import { describe, expect, it, vi } from 'vitest'
import { createClipboardGuard, type ClipboardLike } from './clipboardGuard'

function createFakeClipboard(initial = '') {
  const state = { text: initial }
  const clipboard: ClipboardLike = {
    writeText: vi.fn((value: string) => { state.text = value }),
    readText: vi.fn(() => state.text),
    clear: vi.fn(() => { state.text = '' }),
  }
  return { clipboard, state }
}

function createManualTimer() {
  const pending: Array<{ id: number; callback: () => void; delayMs: number }> = []
  let nextId = 1
  return {
    pending,
    setTimer: (callback: () => void, delayMs: number) => {
      const id = nextId++
      pending.push({ id, callback, delayMs })
      return id
    },
    clearTimer: (timer: unknown) => {
      const index = pending.findIndex((entry) => entry.id === timer)
      if (index >= 0) pending.splice(index, 1)
    },
    fire: () => {
      const entry = pending.shift()
      entry?.callback()
    },
  }
}

describe('clipboard guard', () => {
  it('clears the clipboard after the delay when the value is untouched', () => {
    const { clipboard, state } = createFakeClipboard()
    const timers = createManualTimer()
    const guard = createClipboardGuard(clipboard, timers)

    guard.copyText('secret-value', 30000)
    expect(state.text).toBe('secret-value')
    expect(timers.pending[0]?.delayMs).toBe(30000)

    timers.fire()
    expect(clipboard.clear).toHaveBeenCalledTimes(1)
    expect(state.text).toBe('')
  })

  it('leaves the clipboard alone when another value was copied meanwhile', () => {
    const { clipboard, state } = createFakeClipboard()
    const timers = createManualTimer()
    const guard = createClipboardGuard(clipboard, timers)

    guard.copyText('secret-value', 30000)
    state.text = 'copied by another app'

    timers.fire()
    expect(clipboard.clear).not.toHaveBeenCalled()
    expect(state.text).toBe('copied by another app')
  })

  it('replaces the pending timer when copying again', () => {
    const { clipboard, state } = createFakeClipboard()
    const timers = createManualTimer()
    const guard = createClipboardGuard(clipboard, timers)

    guard.copyText('first', 30000)
    guard.copyText('second', 30000)
    expect(timers.pending.length).toBe(1)

    timers.fire()
    expect(state.text).toBe('')
    expect(clipboard.clear).toHaveBeenCalledTimes(1)
  })

  it('skips auto-clear for empty values or disabled delays', () => {
    const { clipboard } = createFakeClipboard()
    const timers = createManualTimer()
    const guard = createClipboardGuard(clipboard, timers)

    guard.copyText('', 30000)
    guard.copyText('kept-value', null)
    guard.copyText('kept-value', 0)
    expect(timers.pending.length).toBe(0)
  })

  it('survives clipboard read failures inside the timer', () => {
    const timers = createManualTimer()
    const clipboard: ClipboardLike = {
      writeText: vi.fn(),
      readText: vi.fn(() => { throw new Error('clipboard locked') }),
      clear: vi.fn(),
    }
    const guard = createClipboardGuard(clipboard, timers)

    guard.copyText('secret-value', 1000)
    expect(() => timers.fire()).not.toThrow()
    expect(clipboard.clear).not.toHaveBeenCalled()
  })

  it('cancel drops the pending auto-clear', () => {
    const { clipboard, state } = createFakeClipboard()
    const timers = createManualTimer()
    const guard = createClipboardGuard(clipboard, timers)

    guard.copyText('secret-value', 30000)
    guard.cancel()
    expect(timers.pending.length).toBe(0)
    expect(state.text).toBe('secret-value')
  })
})
