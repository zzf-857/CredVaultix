import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT_PLATFORM_OPTIONS } from '../../shared/accountPlatform'
import { applyDatabaseSchema } from '../databaseSchema'
import { TestSqliteDatabase } from '../testSqlite'
import { registerAccountIpc } from './accountsIpc'

const { handlers, showOpenDialog } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  showOpenDialog: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: any[]) => any) => handlers.set(channel, handler),
  },
  dialog: { showOpenDialog },
}))

vi.mock('../crypto', () => ({
  encrypt: (value: string) => value ? `enc:${value}` : '',
  decrypt: (value: string) => value.startsWith('enc:') ? value.slice(4) : value,
}))

function invoke(channel: string, ...args: unknown[]) {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`Missing handler: ${channel}`)
  return handler({}, ...args)
}

describe('account platform IPC persistence', () => {
  let db: TestSqliteDatabase

  beforeEach(() => {
    handlers.clear()
    showOpenDialog.mockReset()
    db = new TestSqliteDatabase()
    applyDatabaseSchema(db as any, { encryptIfNeeded: (value) => value })
    registerAccountIpc({ getDatabase: () => db as any, getMainWindow: () => null })
  })

  afterEach(() => db.close())

  it.each(ACCOUNT_PLATFORM_OPTIONS)('creates, reads and filters the $label platform', ({ platform, label }) => {
    const id = `demo-${platform}`
    invoke('accounts:create', { id, name: `${label} 账号`, platform, username: 'demo@example.com' })
    invoke('accounts:create', { id: 'other-demo', name: 'Other demo', platform: 'other' })

    expect(invoke('accounts:getById', id)).toMatchObject({
      id, platform, username: 'demo@example.com',
    })
    expect(invoke('accounts:getAll', { platform })).toHaveLength(1)
    expect(invoke('accounts:getAll', { platform })[0]).toMatchObject({ id, platform })
    expect(db.prepare('SELECT platform, username FROM accounts WHERE id = ?').get(id))
      .toEqual({ platform, username: 'enc:demo@example.com' })
  })

  it.each(['github', 'qq', 'apple'])('keeps %s when changing the platform through IPC', (platform) => {
    invoke('accounts:create', { id: 'demo-account', name: 'Demo account', platform: 'google' })
    invoke('accounts:update', 'demo-account', { platform })

    expect(invoke('accounts:getById', 'demo-account')).toMatchObject({ platform })
    expect(invoke('accounts:getAll', { platform: 'google' })).toEqual([])
    expect(invoke('accounts:getAll', { platform })[0]).toMatchObject({ id: 'demo-account', platform })
  })

  it('imports case-normalized platform markers from CSV and keeps unrelated accounts', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'credvaultix-platform-csv-'))
    try {
      const filePath = join(temporaryDirectory, 'demo-accounts.csv')
      writeFileSync(filePath, [
        'name,platform,username',
        'Code demo, GitHub ,demo-code',
        'Chat demo,QQ,123456789',
        'Apple demo, Apple ,demo-apple@example.com',
      ].join('\n'), 'utf-8')
      showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })
      invoke('accounts:create', { id: 'existing-demo', name: 'Existing demo', platform: 'google' })

      expect(await invoke('accounts:importCsv')).toEqual({ count: 3, invalidTotpCount: 0, skippedRowCount: 0 })

      expect(invoke('accounts:getAll')).toHaveLength(4)
      for (const platform of ['github', 'qq', 'apple']) {
        expect(invoke('accounts:getAll', { platform })).toHaveLength(1)
        expect(invoke('accounts:getAll', { platform })[0]).toMatchObject({ platform })
      }
      expect(invoke('accounts:getById', 'existing-demo')).toMatchObject({ platform: 'google' })
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(db.pragma('foreign_key_check')).toEqual([])
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })
})
