import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { SCHEMA } from './schema'

let db: Database.Database | null = null

export function getDB(): Database.Database {
  if (db) return db

  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })

  const dbPath = join(userDataPath, 'gerki.db')
  db = new Database(dbPath)

  // Performance-Einstellungen
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  // Schema anlegen
  db.exec(SCHEMA)

  // Migrationen für bestehende DBs
  runMigrations(db)

  // Standard-Skills eintragen
  seedSkills(db)

  console.log(`[DB] Geöffnet: ${dbPath}`)
  return db
}

function runMigrations(db: Database.Database): void {
  // cloud_id Spalte in conversations hinzufügen (für bestehende DBs)
  const cols = db.pragma('table_info(conversations)') as Array<{ name: string }>
  if (!cols.find((c) => c.name === 'cloud_id')) {
    db.exec('ALTER TABLE conversations ADD COLUMN cloud_id TEXT')
  }
  // sync_queue Tabelle (wird durch SCHEMA bereits angelegt wenn sie fehlt)
}

function seedSkills(db: Database.Database): void {
  const defaultSkills = [
    { id: 'skill-behoerdenpost', slug: 'behoerdenpost', name: 'Behördenpost' },
    { id: 'skill-dokumente', slug: 'dokumenten-assistent', name: 'Dokumenten-Assistent' },
    { id: 'skill-email', slug: 'email-manager', name: 'E-Mail-Manager' },
    { id: 'skill-recht', slug: 'rechtsberater', name: 'Rechtsberater' },
    { id: 'skill-buchhaltung', slug: 'buchhaltung', name: 'Buchhaltung' },
    { id: 'skill-hr', slug: 'hr-assistent', name: 'HR-Assistent' },
    { id: 'skill-marketing', slug: 'marketing', name: 'Marketing' },
  ]

  const insert = db.prepare(`
    INSERT OR IGNORE INTO skills (id, slug, name, active)
    VALUES (@id, @slug, @name, 0)
  `)

  const insertMany = db.transaction((skills: typeof defaultSkills) => {
    for (const skill of skills) insert.run(skill)
  })

  insertMany(defaultSkills)
}

export function closeDB(): void {
  if (db) {
    db.close()
    db = null
  }
}
