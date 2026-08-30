import { useEffect, useState } from 'react'
export { getTotpRemainingSeconds, getTotpWindow } from '../utils/otpSnapshot'

let nowMs = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null

function emit() {
  nowMs = Date.now()
  listeners.forEach((listener) => listener())
}

function scheduleNextSecond() {
  const remainder = Date.now() % 1000
  const delay = remainder === 0 ? 1000 : 1000 - remainder
  timer = setTimeout(() => {
    timer = null
    emit()
    if (listeners.size > 0) scheduleNextSecond()
  }, delay)
}

function start() {
  if (timer) return
  emit()
  scheduleNextSecond()
}

function stop() {
  if (listeners.size === 0 && timer) {
    clearTimeout(timer)
    timer = null
  }
}

export function subscribeSharedNow(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) start()
  else listener()

  return () => {
    listeners.delete(listener)
    stop()
  }
}

export function getSharedNowMs() {
  return nowMs
}

export function useSharedNow() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const listener = () => setNow(nowMs)
    return subscribeSharedNow(listener)
  }, [])

  return now
}

export function resetSharedNowForTests(nextNow = Date.now()) {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  listeners.clear()
  nowMs = nextNow
}
