/**
 * Datei-Operationen mit Nutzer-Bestätigung
 *
 * Gibt Gerki kontrollierte Schreibrechte auf das lokale Dateisystem.
 * Jede Aktion zeigt einen nativen Bestätigungs-Dialog BEVOR sie ausgeführt wird.
 * Lokal-first: keine Cloud, keine externen Zugriffe.
 */

import { dialog, BrowserWindow } from 'electron'
import { mkdir, rename, unlink, writeFile as fsWriteFile, rm } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import { dirname, join, isAbsolute } from 'path'

export interface FileOpResult {
  success: boolean
  path?: string
  error?: string
}

async function confirmAction(
  win: BrowserWindow | null,
  message: string,
  detail: string,
  destructive = false
): Promise<boolean> {
  if (!win) return false
  const { response } = await dialog.showMessageBox(win, {
    type: destructive ? 'warning' : 'question',
    title: 'Gerki möchte eine Aktion ausführen',
    message,
    detail,
    buttons: ['Abbrechen', destructive ? 'Trotzdem ausführen' : 'Erlauben'],
    defaultId: 0,
    cancelId: 0
  })
  return response === 1
}

function validatePath(p: string): FileOpResult | null {
  if (!p || typeof p !== 'string') return { success: false, error: 'Ungültiger Pfad' }
  if (!isAbsolute(p)) return { success: false, error: 'Nur absolute Pfade erlaubt' }
  return null
}

export async function createFolder(
  win: BrowserWindow | null,
  folderPath: string
): Promise<FileOpResult> {
  const validation = validatePath(folderPath)
  if (validation) return validation
  try {
    if (existsSync(folderPath)) {
      return { success: false, error: `Ordner existiert bereits: ${folderPath}` }
    }
    const ok = await confirmAction(win, 'Neuen Ordner anlegen?', `Pfad:\n${folderPath}`)
    if (!ok) return { success: false, error: 'Vom Nutzer abgebrochen' }
    await mkdir(folderPath, { recursive: true })
    return { success: true, path: folderPath }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function moveFile(
  win: BrowserWindow | null,
  from: string,
  to: string
): Promise<FileOpResult> {
  const validation = validatePath(from) ?? validatePath(to)
  if (validation) return validation
  try {
    if (!existsSync(from)) return { success: false, error: `Quelle existiert nicht: ${from}` }
    const ok = await confirmAction(win, 'Datei verschieben?', `Von:\n${from}\n\nNach:\n${to}`)
    if (!ok) return { success: false, error: 'Vom Nutzer abgebrochen' }
    await mkdir(dirname(to), { recursive: true })
    await rename(from, to)
    return { success: true, path: to }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function renameFile(
  win: BrowserWindow | null,
  from: string,
  newName: string
): Promise<FileOpResult> {
  const validation = validatePath(from)
  if (validation) return validation
  if (!newName || newName.includes('/') || newName.includes('\\')) {
    return { success: false, error: 'Ungültiger neuer Name' }
  }
  const to = join(dirname(from), newName)
  try {
    if (!existsSync(from)) return { success: false, error: `Quelle existiert nicht: ${from}` }
    const ok = await confirmAction(win, 'Datei umbenennen?', `Von:\n${from}\n\nZu:\n${to}`)
    if (!ok) return { success: false, error: 'Vom Nutzer abgebrochen' }
    await rename(from, to)
    return { success: true, path: to }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function deleteFile(
  win: BrowserWindow | null,
  filePath: string
): Promise<FileOpResult> {
  const validation = validatePath(filePath)
  if (validation) return validation
  try {
    if (!existsSync(filePath)) return { success: false, error: `Pfad existiert nicht: ${filePath}` }
    const isDir = statSync(filePath).isDirectory()
    const ok = await confirmAction(
      win,
      isDir ? 'Ordner löschen?' : 'Datei löschen?',
      `Pfad:\n${filePath}\n\nDiese Aktion kann NICHT rückgängig gemacht werden.`,
      true
    )
    if (!ok) return { success: false, error: 'Vom Nutzer abgebrochen' }
    if (isDir) {
      await rm(filePath, { recursive: true, force: true })
    } else {
      await unlink(filePath)
    }
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function writeFile(
  win: BrowserWindow | null,
  filePath: string,
  content: string
): Promise<FileOpResult> {
  const validation = validatePath(filePath)
  if (validation) return validation
  try {
    const exists = existsSync(filePath)
    const ok = await confirmAction(
      win,
      exists ? 'Datei überschreiben?' : 'Neue Datei erstellen?',
      `Pfad:\n${filePath}\n\nInhaltslänge: ${content.length} Zeichen`,
      exists
    )
    if (!ok) return { success: false, error: 'Vom Nutzer abgebrochen' }
    await mkdir(dirname(filePath), { recursive: true })
    await fsWriteFile(filePath, content, 'utf-8')
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
