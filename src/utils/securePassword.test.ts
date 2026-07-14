import { describe, expect, it } from 'vitest'
import { generateSecurePassword } from './securePassword'

describe('generateSecurePassword', () => {
  it('uses the provided cryptographic random source without Math.random', () => {
    const fillRandomValues = (bytes: Uint8Array<ArrayBuffer>) => {
      bytes.forEach((_value, index) => { bytes[index] = index % 4 })
      return bytes
    }

    expect(generateSecurePassword(12, 'abcd', fillRandomValues)).toBe('abcdabcdabcd')
  })

  it('rejects unsafe lengths and alphabets', () => {
    expect(() => generateSecurePassword(4)).toThrow(/length/i)
    expect(() => generateSecurePassword(20, 'x')).toThrow(/alphabet/i)
  })
})
