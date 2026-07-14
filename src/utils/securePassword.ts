const DEFAULT_PASSWORD_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_-+='

type FillRandomValues = (array: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>

export function generateSecurePassword(
  length = 20,
  alphabet = DEFAULT_PASSWORD_ALPHABET,
  fillRandomValues: FillRandomValues = (array) => globalThis.crypto.getRandomValues(array) as Uint8Array<ArrayBuffer>
) {
  if (!Number.isInteger(length) || length < 8 || length > 256) {
    throw new Error('Password length must be an integer between 8 and 256')
  }
  if (alphabet.length < 2 || alphabet.length > 256) {
    throw new Error('Password alphabet must contain between 2 and 256 characters')
  }
  if (typeof fillRandomValues !== 'function') {
    throw new Error('Secure random number generation is unavailable')
  }

  const rejectionLimit = 256 - (256 % alphabet.length)
  let password = ''

  while (password.length < length) {
    const bytes = new Uint8Array(new ArrayBuffer(Math.max(32, (length - password.length) * 2)))
    fillRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= rejectionLimit) continue
      password += alphabet[byte % alphabet.length]
      if (password.length === length) break
    }
  }

  return password
}
