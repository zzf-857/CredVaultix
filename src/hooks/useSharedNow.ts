import { useEffect, useState } from 'react'

let nowMs = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function emit() {
  nowMs = Date.now()
  listeners.forEach((listener) => listener())
}

function start() {
  if (timer) return
  timer = setInterval(emit, 1000)
}

function stop() {
  if (listeners.size === 0 && timer) {
    clearInterval(timer)
    timer = null
  }
}

export function getSharedNowMs() {
  return nowMs
}

export function getTotpRemainingSeconds(now: number, period: number) {
  const safePeriod = period > 0 ? period : 30
  return safePeriod - (Math.floor(now / 1000) % safePeriod)
}

export function getTotpWindow(now: number, period: number) {
  const safePeriod = period > 0 ? period : 30
  return Math.floor(Math.floor(now / 1000) / safePeriod)
}

export function useSharedNow() {
  const [now, setNow] = useState(() => nowMs)

  useEffect(() => {
    const listener = () => setNow(nowMs)
    listeners.add(listener)
    start()
    setNow(nowMs)
    return () => {
      listeners.delete(listener)
      stop()
    }
  }, [])

  return now
}

export function resetSharedNowForTests(nextNow = Date.now()) {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  listeners.clear()
  nowMs = nextNow
}
