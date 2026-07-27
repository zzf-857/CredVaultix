import { useCallback, useEffect, useRef, useState } from 'react'

type FeedbackKey = string | null

type CopyFeedbackManagerOptions = {
  durationMs: number
  writeText: (value: string) => Promise<void>
  onFeedbackChange: (key: FeedbackKey) => void
  setTimer?: (callback: () => void, delayMs: number) => unknown
  clearTimer?: (timer: unknown) => void
}

export type CopyFeedbackManager = {
  activate: () => void
  copy: (value: string, key: string) => Promise<boolean>
  dispose: () => void
  setDuration: (durationMs: number) => void
}

export function createCopyFeedbackManager({
  durationMs,
  writeText,
  onFeedbackChange,
  setTimer = (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimer = (timer) => window.clearTimeout(timer as number),
}: CopyFeedbackManagerOptions): CopyFeedbackManager {
  let active = true
  let currentDuration = durationMs
  let copiedKey: FeedbackKey = null
  let timer: unknown = null
  let attemptId = 0

  const clearFeedback = (notify: boolean) => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
    if (copiedKey !== null) {
      copiedKey = null
      if (notify && active) onFeedbackChange(null)
    }
  }

  return {
    activate: () => {
      active = true
    },
    copy: async (value, key) => {
      const currentAttempt = ++attemptId
      clearFeedback(true)

      try {
        await writeText(value)
      } catch {
        return false
      }

      if (!active || currentAttempt !== attemptId) return true

      copiedKey = key
      onFeedbackChange(key)
      timer = setTimer(() => {
        timer = null
        if (!active || currentAttempt !== attemptId || copiedKey !== key) return
        copiedKey = null
        onFeedbackChange(null)
      }, currentDuration)
      return true
    },
    dispose: () => {
      active = false
      attemptId += 1
      clearFeedback(false)
    },
    setDuration: (nextDurationMs) => {
      currentDuration = nextDurationMs
    },
  }
}

export default function useCopyFeedback(durationMs = 1500) {
  const [copiedKey, setCopiedKey] = useState<FeedbackKey>(null)
  const managerRef = useRef<CopyFeedbackManager | null>(null)

  if (!managerRef.current) {
    managerRef.current = createCopyFeedbackManager({
      durationMs,
      writeText: (value) => navigator.clipboard.writeText(value),
      onFeedbackChange: setCopiedKey,
    })
  }

  const manager = managerRef.current
  manager.setDuration(durationMs)

  useEffect(() => {
    manager.activate()
    return () => manager.dispose()
  }, [manager])

  const copy = useCallback(
    (value: string, key = 'default') => manager.copy(value, key),
    [manager],
  )

  return { copiedKey, copy }
}
