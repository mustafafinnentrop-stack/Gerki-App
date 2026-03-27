/**
 * Datei-Indexer
 * Überwacht freigegebene Ordner und indexiert Inhalte für die KI-Suche.
 */

import { watch } from 'chokidar'
import { readdirSync, statSync, readFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db/database'

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.xml', '.html'])
const DOC_EXTENSIONS = new Set(['.pdf', '.docx', '.doc'])
const ALL_INDEXED = new Set([...TEXT_EXTENSIONS, ...DOC_EXTENSIONS, '.xlsx', '.jpg', '.png'])

let watchers: Map<string, ReturnType<typeof watch>> = new Map()

// Ordner zur Überwachung hinzufügen
export function watchFolder(folderPath: string, folderName: string): void {
  const db = getDB()
  const id = uuidv4()

  db.prepare('INSERT OR IGNORE INTO watched_folders (id, path, name) VALUES (?, ?, ?)').run(
    id,
    folderPath,
    folderName
  )

  // Sofort indexieren
  indexFolder(folderPath)

  // Änderungen überwachen
  if (!watchers.has(folderPath)) {
    const watcher = watch(folderPath, { persistent: true, ignoreInitial: true })
    watcher.on('add', (filePath) => indexFile(filePath))
    watcher.on('change', (filePath) => indexFile(filePath))
    watcher.on('unlink', (filePath) => removeFile(filePath))
    watchers.set(folderPath, watcher)
  }
}

// Ordner aus Überwachung entfernen
export function unwatchFolder(folderPath: string): void {
  const db = getDB()
  db.prepare('UPDATE watched_folders SET active = 0 WHERE path = ?').run(folderPath)
  const watcher = watchers.get(folderPath)
  if (watcher) {
    watcher.close()
    watchers.delete(folderPath)
  }
}

// Alle überwachten Ordner beim Start neu laden
export function restoreWatchers(): void {
  const db = getDB()
  const folders = db
    .prepare('SELECT path, name FROM watched_folders WHERE active = 1')
    .all() as Array<{ path: string; name: string }>

  for (const folder of folders) {
    try {
      watchFolder(folder.path, folder.name)
    } catch {
      // Ordner existiert nicht mehr
    }
  }
}

// Ganzen Ordner indexieren
function indexFolder(folderPath: string): void {
  try {
    const entries = readdirSync(folderPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(folderPath, entry.name)
      if (entry.isDirectory()) {
        // Unterordner rekursiv (max 3 Ebenen)
        const depth = folderPath.split('/').length
        if (depth < 6) indexFolder(fullPath)
      } else {
        indexFile(fullPath)
      }
    }
  } catch {
    // Zugriff verweigert oder Ordner nicht vorhanden
  }
}

// Einzelne Datei indexieren
function indexFile(filePath: string): void {
  const ext = extname(filePath).toLowerCase()
  if (!ALL_INDEXED.has(ext)) return

  try {
    const stat = statSync(filePath)
    if (stat.size > 50 * 1024 * 1024) return // Max 50 MB

    const name = basename(filePath)
    let contentText: string | null = null

    if (TEXT_EXTENSIONS.has(ext)) {
      contentText = readFileSync(filePath, 'utf-8').slice(0, 10000)
    }
    // PDFs und DOCX werden async verarbeitet (vereinfacht: nur Metadaten)

    const category = getCategory(ext)
    const db = getDB()

    db.prepare(`
      INSERT INTO file_index (id, path, name, extension, size, content_text, category, modified_at)
      VALUES (@id, @path, @name, @ext, @size, @content, @category, @modified)
      ON CONFLICT(path) DO UPDATE SET
        size = @size, content_text = @content, modified_at = @modified
    `).run({
      id: uuidv4(),
      path: filePath,
      name,
      ext,
      size: stat.size,
      content: contentText,
      category,
      modified: stat.mtime.toISOString()
    })
  } catch {
    // Datei nicht lesbar
  }
}

// Datei aus Index entfernen
function removeFile(filePath: string): void {
  getDB().prepare('DELETE FROM file_index WHERE path = ?').run(filePath)
}

// Stoppwörter die nicht gesucht werden sollen
const STOPWORDS = new Set([
  'ich','du','er','sie','es','wir','ihr','ein','eine','einer','ist','bin',
  'hat','haben','habe','mit','von','für','und','oder','aber','nicht','auch',
  'das','die','der','den','dem','des','auf','an','in','zu','bei','nach',
  'wie','was','wer','wo','bitte','kannst','kann','mir','mich','mein','meine',
  'hast','hatte','gibt','gib','suche','suchen','finde','finden','zeig','zeige',
  'bitte','noch','mal','nochmal','schau','hilf','hilfe','such','schon'
])

// Dateien nach Suchbegriff suchen – extrahiert Schlüsselwörter aus dem Satz
export function searchFiles(
  query: string,
  limit = 10
): Array<{
  path: string
  name: string
  category: string
  content_text: string | null
}> {
  const db = getDB()

  // Keywords extrahieren: Wörter >3 Zeichen, keine Stoppwörter
  const keywords = query
    .toLowerCase()
    .replace(/[^\wäöüß\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))

  if (keywords.length === 0) {
    // Keine Keywords → neueste Dateien zurückgeben
    return db
      .prepare(`SELECT path, name, category, content_text FROM file_index ORDER BY modified_at DESC LIMIT ?`)
      .all(limit) as Array<{ path: string; name: string; category: string; content_text: string | null }>
  }

  // Für jedes Keyword suchen und Ergebnisse sammeln (ranked by hits)
  const seen = new Set<string>()
  const results: Array<{ path: string; name: string; category: string; content_text: string | null }> = []

  for (const kw of keywords) {
    const q = `%${kw}%`
    const rows = db
      .prepare(`
        SELECT path, name, category, content_text
        FROM file_index
        WHERE lower(name) LIKE ? OR lower(content_text) LIKE ?
        ORDER BY modified_at DESC
        LIMIT ?
      `)
      .all(q, q, limit) as Array<{ path: string; name: string; category: string; content_text: string | null }>

    for (const row of rows) {
      if (!seen.has(row.path)) {
        seen.add(row.path)
        results.push(row)
      }
    }
    if (results.length >= limit) break
  }

  return results.slice(0, limit)
}

// Dateikategorie bestimmen
function getCategory(ext: string): string {
  if (['.pdf', '.doc', '.docx'].includes(ext)) return 'dokument'
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return 'bild'
  if (['.xlsx', '.csv'].includes(ext)) return 'tabelle'
  if (['.mp4', '.mov', '.avi'].includes(ext)) return 'video'
  if (['.mp3', '.wav'].includes(ext)) return 'audio'
  return 'datei'
}

// Alle überwachten Ordner abrufen
export function getWatchedFolders(): Array<{ id: string; path: string; name: string; active: number }> {
  return getDB()
    .prepare('SELECT id, path, name, active FROM watched_folders ORDER BY name')
    .all() as Array<{ id: string; path: string; name: string; active: number }>
}

// Indexierungsstatistik
export function getIndexStats(): { totalFiles: number; totalFolders: number } {
  const db = getDB()
  const files = db.prepare('SELECT COUNT(*) as count FROM file_index').get() as { count: number }
  const folders = db
    .prepare('SELECT COUNT(*) as count FROM watched_folders WHERE active = 1')
    .get() as { count: number }
  return { totalFiles: files.count, totalFolders: folders.count }
}
