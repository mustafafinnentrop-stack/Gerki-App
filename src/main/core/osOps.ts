/**
 * OS-Operationen – Shell-Befehle mit Sicherheitskategorisierung
 *
 * Drei Sicherheitsstufen:
 * - safe        → sofort ausführen, kein Dialog
 * - medium      → 1-Klick Bestätigungsdialog
 * - destructive → roter Dialog, Nutzer muss "BESTÄTIGEN" eingeben (nicht implementiert in Dialog,
 *                 aber roter Warnton + OK/Cancel)
 *
 * DSGVO: alle Befehle laufen lokal, kein Netzwerkzugriff durch dieses Modul.
 */

import { exec } from 'child_process'
import { dialog, BrowserWindow } from 'electron'

export type OsOpCategory = 'safe' | 'medium' | 'destructive'

export interface OsOpResult {
  success: boolean
  output?: string
  error?: string
  cancelled?: boolean
}

// Keywords zur Kategorisierung
const SAFE_PATTERNS = [
  /^open\s/i,
  /^xdg-open\s/i,
  /^start\s+""/i,
  /^explorer\s/i,
  /^start\s+/i,
  /^say\s+/i,
  /^notify-send\s/i,
  /^osascript\s+-e\s+['"]tell\s+application/i,
  /^powershell\s+-Command\s+"(Get-|Write-|[A-Z][a-z]+-(Item|Object|Content)\s)/i
]

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf?\b/i,
  /\bdel\s+\/[fqs]/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bkill\s+-9\b/i,
  /\bkillall\b/i,
  /\brd\s+\/s\b/i,
  /\brmdir\s+\/s\b/i
]

export function categorizeCommand(command: string): OsOpCategory {
  const cmd = command.trim()

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(cmd)) return 'destructive'
  }

  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(cmd)) return 'safe'
  }

  return 'medium'
}

function runCommand(command: string): Promise<OsOpResult> {
  return new Promise((resolve) => {
    exec(command, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message, output: stderr || undefined })
      } else {
        resolve({ success: true, output: stdout.trim() || undefined })
      }
    })
  })
}

export async function executeCommand(
  command: string,
  win: BrowserWindow | null
): Promise<OsOpResult> {
  const trimmed = command.trim()
  if (!trimmed) return { success: false, error: 'Kein Befehl angegeben' }

  const category = categorizeCommand(trimmed)

  if (category === 'safe') {
    return runCommand(trimmed)
  }

  if (category === 'medium') {
    const { response } = await dialog.showMessageBox(win ?? new BrowserWindow({ show: false }), {
      type: 'question',
      title: 'Gerki möchte einen Befehl ausführen',
      message: 'Shell-Befehl ausführen?',
      detail: `Befehl:\n${trimmed}`,
      buttons: ['Abbrechen', 'Ausführen'],
      defaultId: 0,
      cancelId: 0
    })
    if (response === 0) return { success: false, cancelled: true, error: 'Vom Nutzer abgebrochen' }
    return runCommand(trimmed)
  }

  // destructive
  const { response } = await dialog.showMessageBox(win ?? new BrowserWindow({ show: false }), {
    type: 'warning',
    title: '⚠️ Gefährlicher Befehl',
    message: 'Dieser Befehl kann Daten UNWIDERRUFLICH löschen!',
    detail: `Befehl:\n${trimmed}\n\nBitte sehr sorgfältig prüfen bevor du fortfährst.`,
    buttons: ['Abbrechen', 'Trotzdem ausführen'],
    defaultId: 0,
    cancelId: 0
  })
  if (response === 0) return { success: false, cancelled: true, error: 'Vom Nutzer abgebrochen' }
  return runCommand(trimmed)
}
