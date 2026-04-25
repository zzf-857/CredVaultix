import { describe, expect, it } from 'vitest'
import databaseSource from '../../electron/database.ts?raw'
import mainSource from '../../electron/main.ts?raw'
import preloadSource from '../../electron/preload.ts?raw'

describe('legacy 1.x cleanup', () => {
  it('does not expose prompt or folder preload APIs', () => {
    expect(preloadSource).not.toContain('getPrompts')
    expect(preloadSource).not.toContain('getPromptById')
    expect(preloadSource).not.toContain('createPrompt')
    expect(preloadSource).not.toContain('updatePrompt')
    expect(preloadSource).not.toContain('deletePrompt')
    expect(preloadSource).not.toContain('getFolders')
    expect(preloadSource).not.toContain('createFolder')
    expect(preloadSource).not.toContain('updateFolder')
    expect(preloadSource).not.toContain('deleteFolder')
  })

  it('does not register prompt or folder IPC channels', () => {
    expect(mainSource).not.toContain("'prompts:getAll'")
    expect(mainSource).not.toContain("'prompts:getById'")
    expect(mainSource).not.toContain("'prompts:create'")
    expect(mainSource).not.toContain("'prompts:update'")
    expect(mainSource).not.toContain("'prompts:delete'")
    expect(mainSource).not.toContain("'folders:getAll'")
    expect(mainSource).not.toContain("'folders:create'")
    expect(mainSource).not.toContain("'folders:update'")
    expect(mainSource).not.toContain("'folders:delete'")
    expect(mainSource).not.toContain('promptTags:')
    expect(mainSource).not.toContain('prompts:')
    expect(mainSource).not.toContain('folders:')
  })

  it('does not create prompt or folder database tables for new installs', () => {
    expect(databaseSource).not.toContain('CREATE TABLE IF NOT EXISTS folders')
    expect(databaseSource).not.toContain('CREATE TABLE IF NOT EXISTS prompts')
    expect(databaseSource).not.toContain('CREATE TABLE IF NOT EXISTS prompt_tags')
    expect(databaseSource).not.toContain('folder_id TEXT')
    expect(databaseSource).not.toContain('idx_accounts_folder')
  })
})
