export interface ClipboardLike {
  writeText: (value: string) => void
  readText: () => string
  clear: () => void
}

export interface ClipboardGuardOptions {
  setTimer?: (callback: () => void, delayMs: number) => unknown
  clearTimer?: (timer: unknown) => void
}

export interface ClipboardGuard {
  copyText: (value: string, clearAfterMs: number | null) => void
  cancel: () => void
}

// Writes text to the clipboard and, when requested, clears it again after a
// delay - but only if the clipboard still holds the exact copied value, so a
// newer copy from any application is never destroyed.
export function createClipboardGuard(
  clipboard: ClipboardLike,
  {
    setTimer = (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  }: ClipboardGuardOptions = {}
): ClipboardGuard {
  let timer: unknown = null
  let expectedValue: string | null = null

  const cancel = () => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
    expectedValue = null
  }

  return {
    copyText: (value, clearAfterMs) => {
      cancel()
      clipboard.writeText(value)
      if (!value || !clearAfterMs || clearAfterMs <= 0) return

      expectedValue = value
      timer = setTimer(() => {
        timer = null
        const pendingValue = expectedValue
        expectedValue = null
        try {
          if (pendingValue !== null && clipboard.readText() === pendingValue) {
            clipboard.clear()
          }
        } catch {
          // Reading the clipboard can fail if another process locks it; never crash.
        }
      }, clearAfterMs)
    },
    cancel,
  }
}
