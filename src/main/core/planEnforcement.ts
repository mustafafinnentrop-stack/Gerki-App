/**
 * Plan-Enforcement für Gerki
 *
 * Pläne (JWT `plan`-Wert):
 *   free     – Testphase → nur Ollama, nur general
 *   standard – 39,90 €/Mo → 2 Agents (Behördenpost + Dokumente), Ollama
 *   pro      – 59,90 €/Mo → 5 Agents + Cloud-Sync, Ollama
 *   business – 89,90 €/Mo → alle 8 Agents, Claude/GPT-4, Multi-User, Cloud-Sync
 *
 * Anti-Cheat:
 *   - Plan kommt ausschließlich aus serverside-signiertem JWT (gerki.app)
 *   - JWT läuft täglich ab, App muss online refreshen
 *   - Offline max. 7 Tage (danach plan = 'free' bis nächster Verify)
 *   - 1 Trial pro E-Mail (Domain-Blacklist auf Server)
 *   - Gerät-Fingerprint serverside gespeichert
 */

export type Plan = 'free' | 'standard' | 'pro' | 'business'

// Welche Skills sind pro Plan erlaubt?
const ALLOWED_SKILLS: Record<Plan, string[]> = {
  free:     ['general'],
  standard: ['general', 'behoerdenpost', 'dokumenten-assistent'],
  pro:      ['general', 'behoerdenpost', 'dokumenten-assistent', 'rechtsberater', 'email-manager', 'hr-assistent', 'buchhaltung'],
  business: ['general', 'behoerdenpost', 'dokumenten-assistent', 'rechtsberater', 'email-manager', 'hr-assistent', 'buchhaltung', 'marketing']
}

// Welche Modelle sind pro Plan erlaubt?
const ALLOWED_MODELS: Record<Plan, string[]> = {
  free:     ['ollama'],
  standard: ['ollama'],
  pro:      ['ollama'],
  business: ['ollama', 'claude', 'gpt-4', 'gpt-3.5']
}

// Cloud-Sync ab Pro
export const CLOUD_SYNC_PLANS: Plan[] = ['pro', 'business']

const PLAN_NAMES: Record<Plan, string> = {
  free:     'Testversion',
  standard: 'Standard',
  pro:      'Pro',
  business: 'Business'
}

const UPGRADE_HINTS: Record<Plan, string> = {
  free:     'Upgrade auf Standard (39,90 €/Mo) um diesen Assistenten zu nutzen.',
  standard: 'Upgrade auf Pro (59,90 €/Mo) um diesen Assistenten zu nutzen.',
  pro:      'Upgrade auf Business (89,90 €/Mo) um diesen Assistenten zu nutzen.',
  business: ''
}

// Max. Offline-Tage bevor Plan auf free zurückfällt
export const MAX_OFFLINE_DAYS = 7

export function isSkillAllowed(plan: string, skillSlug: string): boolean {
  const p = (plan as Plan) in ALLOWED_SKILLS ? (plan as Plan) : 'free'
  return ALLOWED_SKILLS[p].includes(skillSlug)
}

export function isModelAllowed(plan: string, model: string): boolean {
  const p = (plan as Plan) in ALLOWED_MODELS ? (plan as Plan) : 'free'
  return ALLOWED_MODELS[p].includes(model)
}

export function isCloudSyncAllowed(plan: string): boolean {
  return CLOUD_SYNC_PLANS.includes(plan as Plan)
}

export function getPlanName(plan: string): string {
  return PLAN_NAMES[(plan as Plan)] ?? 'Unbekannt'
}

export function getUpgradeHint(plan: string): string {
  return UPGRADE_HINTS[(plan as Plan)] ?? 'Upgrade erforderlich.'
}

export function checkAccess(
  plan: string,
  skillSlug: string,
  model: string
): { allowed: boolean; error?: string } {
  if (!isSkillAllowed(plan, skillSlug)) {
    const hint = getUpgradeHint(plan)
    return {
      allowed: false,
      error: `Der Assistent "${skillSlug}" ist in deinem ${getPlanName(plan)}-Plan nicht verfügbar. ${hint}`
    }
  }
  if (!isModelAllowed(plan, model)) {
    const hint = getUpgradeHint(plan)
    return {
      allowed: false,
      error: `Das Modell "${model}" ist in deinem ${getPlanName(plan)}-Plan nicht verfügbar. ${hint}`
    }
  }
  return { allowed: true }
}

/**
 * Offline-Check: Gibt 'free' zurück wenn User zu lange offline ist.
 * lastVerifiedAt = Timestamp des letzten erfolgreichen /api/app/auth/verify
 */
export function getEffectivePlan(plan: string, lastVerifiedAt: number): Plan {
  const daysSinceVerify = (Date.now() - lastVerifiedAt) / (1000 * 60 * 60 * 24)
  if (daysSinceVerify > MAX_OFFLINE_DAYS) return 'free'
  // Legacy-Mapping: 'enterprise' → 'business' (alte JWT-Werte)
  if (plan === 'enterprise') return 'business'
  return (plan as Plan) in ALLOWED_SKILLS ? (plan as Plan) : 'free'
}
