import type Database from 'better-sqlite3'
import { clipboard, dialog, ipcMain, nativeImage, type BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import {
  createTotpRecord,
  createTotpRecords,
  deleteTotpRecord,
  incrementHotpCounter,
  updateTotpRecord,
  type TotpWriteData,
} from '../accountTotpRepository'
import { decrypt, decryptBuffer, encrypt, encryptBuffer } from '../crypto'
import { getTotpQrImage } from '../totpQrImageRepository'
import { prepareTotpQrImage } from '../totpQrImageValidation'
import { listTotpAccounts } from '../totpListRepository'

interface RegisterTotpIpcOptions {
  getDatabase: () => Database.Database
  getMainWindow: () => BrowserWindow | null
}

function prepareTotpWriteData<T extends TotpWriteData>(data: T): T {
  if (!Object.prototype.hasOwnProperty.call(data, 'qrImage')) return data
  return { ...data, qrImage: prepareTotpQrImage(data.qrImage) } as T
}

async function chooseQrImageDestination(
  mainWindow: BrowserWindow | null,
  defaultPath: string,
  mimeType: string
) {
  const options = {
    title: '保存 2FA 二维码',
    defaultPath,
    filters: [{
      name: mimeType === 'image/jpeg' ? 'JPEG 图片' : 'PNG 图片',
      extensions: mimeType === 'image/jpeg' ? ['jpg', 'jpeg'] : ['png'],
    }],
  }
  return mainWindow
    ? dialog.showSaveDialog(mainWindow, options)
    : dialog.showSaveDialog(options)
}

export function registerTotpIpc(options: RegisterTotpIpcOptions) {
  ipcMain.handle('totp:getAll', () => {
    return listTotpAccounts(options.getDatabase(), { decrypt })
  })

  ipcMain.handle('totp:create', (_event, data: TotpWriteData & { id: string }) => (
    createTotpRecord(
      options.getDatabase(),
      prepareTotpWriteData(data),
      { encrypt, decrypt, encryptBuffer }
    )
  ))
  ipcMain.handle('totp:createMany', (_event, records: Array<TotpWriteData & { id: string }>) => {
    if (!Array.isArray(records) || records.length === 0 || records.length > 1000) {
      throw new Error('批量导入数量必须在 1 到 1000 条之间')
    }

    const preparedRecords: Array<TotpWriteData & { id: string }> = []
    let skippedCount = 0
    for (const record of records) {
      try {
        preparedRecords.push(prepareTotpWriteData(record))
      } catch {
        skippedCount += 1
      }
    }

    const result = createTotpRecords(
      options.getDatabase(),
      preparedRecords,
      { encrypt, decrypt, encryptBuffer }
    )
    return {
      createdCount: result.createdCount,
      skippedCount: result.skippedCount + skippedCount,
    }
  })
  ipcMain.handle('totp:update', (_event, id: string, data: TotpWriteData) => (
    updateTotpRecord(
      options.getDatabase(),
      id,
      prepareTotpWriteData(data),
      { encrypt, decrypt, encryptBuffer }
    )
  ))
  ipcMain.handle('totp:delete', (_event, id: string) => (
    deleteTotpRecord(options.getDatabase(), id, { encrypt })
  ))
  ipcMain.handle('totp:incrementCounter', (_event, id: string) => (
    incrementHotpCounter(options.getDatabase(), id)
  ))

  ipcMain.handle('totp:getQrImage', (_event, id: string) => {
    const record = getTotpQrImage(options.getDatabase(), id, { decryptBuffer })
    if (!record) return null
    return {
      dataUrl: `data:${record.mimeType};base64,${record.bytes.toString('base64')}`,
      mimeType: record.mimeType,
      originalName: record.originalName,
      originalSize: record.originalSize,
    }
  })

  ipcMain.handle('totp:copyQrImage', (_event, id: string) => {
    const record = getTotpQrImage(options.getDatabase(), id, { decryptBuffer })
    if (!record) return { success: false }

    const image = nativeImage.createFromBuffer(record.bytes)
    if (image.isEmpty()) throw new Error('无法读取已保存的二维码图片')
    clipboard.writeImage(image)
    return { success: true }
  })

  ipcMain.handle('totp:saveQrImage', async (_event, id: string) => {
    const record = getTotpQrImage(options.getDatabase(), id, { decryptBuffer })
    if (!record) return { success: false }

    const extension = record.mimeType === 'image/jpeg' ? '.jpg' : '.png'
    const originalPath = path.parse(record.originalName)
    const result = await chooseQrImageDestination(
      options.getMainWindow(),
      `${originalPath.name || '2fa-qrcode'}${extension}`,
      record.mimeType
    )
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    fs.writeFileSync(result.filePath, record.bytes)
    return { success: true, filePath: result.filePath }
  })
}
