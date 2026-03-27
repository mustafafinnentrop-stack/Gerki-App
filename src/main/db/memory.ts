/**
 * Memory-System – das Herzstück von Gerki.
 *
 * Der PA lernt kontinuierlich über den Nutzer:
 * - Persönliche Fakten (Name, Beruf, Familie)
 * - Präferenzen (bevorzugter Schreibstil, Lieblingsmodell)
 * - Gelernte Muster (was hat der Nutzer heute gefragt?)
 * - Aufgaben-Kontext (was wurde erledigt, was steht an?)
 */

import { v4 as uuidv4 } from 'uuid'
import { getDB } from './database'

export interface MemoryEntry {
  id: string
  category: string
  key: string
  value: string
  source?: string
  confidence: number
  created_at: string
  updated_at: string
}

// Alle Einträge aus dem Memory lesen – für den Orchestrator
export function getAllMemory(): MemoryEntry[] {
  const db = getDB()
  return db.prepare('SELECT * FROM memory ORDER BY category, key').all() as MemoryEntry[]
}

// Kompakten Memory-Kontext für System-Prompt erstellen
export function buildMemoryContext(): string {
  const entries = getAllMemory()
  if (entries.length === 0) return ''

  const grouped: Record<string, MemoryEntry[]> = {}
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = []
    grouped[entry.category].push(entry)
  }

  const lines: string[] = ['=== Was ich über dich weiß ===']

  const categoryLabels: Record<string, string> = {
    person: 'Persönliches',
    preference: 'Präferenzen',
    fact: 'Fakten',
    task: 'Aufgaben-Kontext',
    learned: 'Gelernt'
  }

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`\n[${categoryLabels[cat] ?? cat}]`)
    for (const item of items) {
      lines.push(`• ${item.key}: ${item.value}`)
    }
  }

  return lines.join('\n')
}

// Neues Wissen speichern (überschreibt bei gleichem category+key)
export function rememberFact(
  category: string,
  key: string,
  value: string,
  source?: string,
  confidence = 1.0
): void {
  const db = getDB()
  const existing = db
    .prepare('SELECT id FROM memory WHERE category = ? AND key = ?')
    .get(category, key) as { id: string } | undefined

  if (existing) {
    db.prepare(`
      UPDATE memory SET value = ?, source = ?, confidence = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(value, source ?? null, confidence, existing.id)
  } else {
    db.prepare(`
      INSERT INTO memory (id, category, key, value, source, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), category, key, value, source ?? null, confidence)
  }
}

// Mehrere Fakten auf einmal speichern (aus KI-Antwort extrahiert)
export function rememberFacts(
  facts: Array<{ category: string; key: string; value: string }>,
  source?: string
): void {
  const db = getDB()
  const upsert = db.prepare(`
    INSERT INTO memory (id, category, key, value, source)
    VALUES (@id, @category, @key, @value, @source)
    ON CONFLICT(category, key) DO UPDATE SET
      value = @value, source = @source, updated_at = datetime('now')
  `)

  const tx = db.transaction(() => {
    for (const fact of facts) {
      upsert.run({ id: uuidv4(), ...fact, source: source ?? null })
    }
  })
  tx()
}

// Spezifisches Memory suchen
export function searchMemory(query: string): MemoryEntry[] {
  const db = getDB()
  const q = `%${query.toLowerCase()}%`
  return db
    .prepare(`
      SELECT * FROM memory
      WHERE lower(key) LIKE ? OR lower(value) LIKE ?
      ORDER BY updated_at DESC LIMIT 20
    `)
    .all(q, q) as MemoryEntry[]
}

// Memory-Eintrag löschen
export function forgetFact(id: string): void {
  getDB().prepare('DELETE FROM memory WHERE id = ?').run(id)
}

// Gesprächszusammenfassung speichern
export function saveConversationSummary(conversationId: string, summary: string): void {
  rememberFact('learned', `conversation_${conversationId}`, summary, 'auto-summary', 0.8)
}
