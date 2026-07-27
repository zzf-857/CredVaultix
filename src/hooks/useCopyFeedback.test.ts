import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCopyFeedbackManager } from './useCopyFeedback'

function createManager(writeText = vi.fn().mockResolvedValue(undefined)) {
  const feedback: Array<string | null> = []
  const clearTimer = vi.fn((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>))
  const manager = createCopyFeedbackManager({
    durationMs: 1500,
    writeText,
    onFeedbackChange: (key) => feedback.push(key),
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer,
  })

  return { clearTimer, feedback, manager, writeText }
}

describe('copy feedback manager', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts feedback only after a successful clipboard write', async () => {
    const { feedback, manager, writeText } = createManager()

    await expect(manager.copy('secret', 'password')).resolves.toBe(true)

    expect(writeText).toHaveBeenCalledWith('secret')
    expect(feedback).toEqual(['password'])
    manager.dispose()
  })

  it('restarts the feedback timer when copied again', async () => {
    vi.useFakeTimers()
    const { feedback, manager } = createManager()

    await manager.copy('first', 'field')
    await vi.advanceTimersByTimeAsync(1000)
    await manager.copy('second', 'field')
    await vi.advanceTimersByTimeAsync(1000)
    expect(feedback[feedback.length - 1]).toBe('field')

    await vi.advanceTimersByTimeAsync(500)
    expect(feedback[feedback.length - 1]).toBeNull()
  })

  it('does not report success when the clipboard write fails', async () => {
    const { feedback, manager } = createManager(vi.fn().mockRejectedValue(new Error('denied')))

    await expect(manager.copy('secret', 'password')).resolves.toBe(false)
    expect(feedback).toEqual([])
  })

  it('cleans up its timer without updating feedback after disposal', async () => {
    vi.useFakeTimers()
    const { clearTimer, feedback, manager } = createManager()

    await manager.copy('secret', 'password')
    manager.dispose()
    await vi.runAllTimersAsync()

    expect(clearTimer).toHaveBeenCalledOnce()
    expect(feedback).toEqual(['password'])
  })
})
