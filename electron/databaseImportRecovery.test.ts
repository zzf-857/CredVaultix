import { describe, expect, it, vi } from 'vitest'
import { recoverDatabaseAfterFailedImport } from './databaseImportRecovery'

function createOptions(overrides: Record<string, unknown> = {}) {
  const database = {
    open: true,
    close: vi.fn(function (this: { open: boolean }) {
      this.open = false
    }),
  }
  return {
    database,
    options: {
      importError: new Error('candidate initialization failed'),
      backupPath: 'verified-backup.db',
      databasePath: 'credvaultix.db',
      fileExists: vi.fn(() => true),
      restoreDatabase: vi.fn(),
      initializeDatabase: vi.fn(() => database),
      activateDatabase: vi.fn(),
      ...overrides,
    },
  }
}

describe('database import recovery', () => {
  it('restores, initializes and activates the original database in order', () => {
    const order: string[] = []
    const { database, options } = createOptions({
      restoreDatabase: vi.fn(() => order.push('restore')),
      initializeDatabase: vi.fn(() => {
        order.push('initialize')
        return database
      }),
      activateDatabase: vi.fn(() => order.push('activate')),
    })

    expect(recoverDatabaseAfterFailedImport(options as any)).toBe(database)
    expect(order).toEqual(['restore', 'initialize', 'activate'])
  })

  it('treats a missing or externally removed backup as a fatal recovery failure', () => {
    const { options } = createOptions({ fileExists: vi.fn(() => false) })

    expect(() => recoverDatabaseAfterFailedImport(options as any))
      .toThrow(/安全备份不存在或已不可用/)
    expect(options.restoreDatabase).not.toHaveBeenCalled()
    expect(options.initializeDatabase).not.toHaveBeenCalled()
  })

  it('wraps a restore failure instead of leaving the caller with a closed connection', () => {
    const { options } = createOptions({
      restoreDatabase: vi.fn(() => {
        throw new Error('disk write failed')
      }),
    })

    expect(() => recoverDatabaseAfterFailedImport(options as any))
      .toThrow(/自动恢复原数据库失败：disk write failed/)
    expect(options.initializeDatabase).not.toHaveBeenCalled()
  })

  it('closes a recovered connection when consumer activation fails', () => {
    const { database, options } = createOptions({
      activateDatabase: vi.fn(() => {
        throw new Error('consumer activation failed')
      }),
    })

    expect(() => recoverDatabaseAfterFailedImport(options as any))
      .toThrow(/consumer activation failed/)
    expect(database.close).toHaveBeenCalledOnce()
    expect(database.open).toBe(false)
  })
})
