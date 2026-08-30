import { describe, expect, it } from 'vitest'
import {
  hasDragType,
  SERVICE_DRAG_TYPE,
  SERVICE_FIELD_DRAG_TYPE,
} from './dragTypes'

describe('service information drag domains', () => {
  it('keeps service and field payloads isolated', () => {
    expect(SERVICE_DRAG_TYPE).not.toBe(SERVICE_FIELD_DRAG_TYPE)
    expect(hasDragType([SERVICE_DRAG_TYPE], SERVICE_DRAG_TYPE)).toBe(true)
    expect(hasDragType([SERVICE_FIELD_DRAG_TYPE], SERVICE_DRAG_TYPE)).toBe(false)
    expect(hasDragType(['text/plain'], SERVICE_FIELD_DRAG_TYPE)).toBe(false)
  })
})
