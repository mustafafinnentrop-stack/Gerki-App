import { readFileSync, existsSync } from 'fs'
import { platform } from 'os'
import { exec } from 'child_process'

export interface CalendarEvent {
  title: string
  startTime: string
  endTime?: string
  location?: string
}

function runCmd(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000 }, (err, stdout) => resolve(err ? '' : stdout.trim()))
  })
}

function stripCRLF(s: string): string {
  // ICS files use CRLF and may have folded lines (continuation with space)
  return s.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n')
}

function parseICS(content: string): CalendarEvent[] {
  const cleaned = stripCRLF(content)
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD

  const events: CalendarEvent[] = []
  const blocks = cleaned.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? []

  for (const block of blocks) {
    const get = (key: string): string => {
      const m = block.match(new RegExp(`(?:^|\\n)${key}[^:;\\n]*:([^\\n]*)`, 'i'))
      return m ? m[1].trim() : ''
    }

    const dtstart = get('DTSTART')
    if (!dtstart.startsWith(todayStr)) continue

    const summary = get('SUMMARY').replace(/\\[,;nN]/g, (m) => m === '\\n' || m === '\\N' ? ' ' : m.slice(1))
    const location = get('LOCATION').replace(/\\[,;nN]/g, (m) => m === '\\n' || m === '\\N' ? ' ' : m.slice(1))
    if (!summary) continue

    const isAllDay = dtstart.length === 8
    let startTime = 'Ganztägig'
    let endTime: string | undefined

    if (!isAllDay) {
      const t = dtstart.slice(9, 13) // HHMM part from YYYYMMDDTHHMMSSZ
      startTime = `${t.slice(0, 2)}:${t.slice(2, 4)}`
      const dtend = get('DTEND')
      if (dtend.length > 8) {
        const te = dtend.slice(9, 13)
        endTime = `${te.slice(0, 2)}:${te.slice(2, 4)}`
      }
    }

    events.push({ title: summary, startTime, endTime, location: location || undefined })
  }

  return events.sort((a, b) => {
    if (a.startTime === 'Ganztägig') return -1
    if (b.startTime === 'Ganztägig') return 1
    return a.startTime.localeCompare(b.startTime)
  })
}

async function getMacOSEvents(): Promise<CalendarEvent[]> {
  const script = `
tell application "Calendar"
  set tod to current date
  set startOfDay to tod - (time of tod)
  set endOfDay to startOfDay + (23 * hours + 59 * minutes + 59)
  set result to {}
  repeat with cal in every calendar
    repeat with evt in (every event of cal whose start date >= startOfDay and start date <= endOfDay)
      set evtTitle to summary of evt
      set evtStart to start date of evt as string
      set end of result to evtTitle & "|||" & evtStart
    end repeat
  end repeat
  set AppleScript's text item delimiters to "~~~~"
  result as string
end tell
`.trim()

  const output = await runCmd(`osascript << 'APPLESCRIPT'\n${script}\nAPPLESCRIPT`)
  if (!output) return []

  const events: CalendarEvent[] = []
  for (const line of output.split('~~~~')) {
    const sep = line.indexOf('|||')
    if (sep < 0) continue
    const title = line.slice(0, sep).trim()
    const dateStr = line.slice(sep + 3).trim()
    // AppleScript date: "Sunday, 27 April 2025 at 09:00:00"
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2}):\d{2}/)
    const startTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : 'Ganztägig'
    if (title) events.push({ title, startTime })
  }
  return events
}

export async function getTodayEvents(calendarPath?: string): Promise<{
  success: boolean
  events?: CalendarEvent[]
  source?: string
  error?: string
}> {
  // 1. .ics file (all platforms)
  if (calendarPath && existsSync(calendarPath)) {
    try {
      const content = readFileSync(calendarPath, 'utf-8')
      return { success: true, events: parseICS(content), source: 'ics' }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  // 2. macOS Calendar.app via AppleScript
  if (platform() === 'darwin') {
    try {
      const events = await getMacOSEvents()
      return { success: true, events, source: 'macos-calendar' }
    } catch { /* fall through */ }
  }

  return {
    success: false,
    error: 'Kein Kalender konfiguriert. Bitte .ics-Datei in den Einstellungen hinterlegen.'
  }
}
