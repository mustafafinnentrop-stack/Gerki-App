/**
 * Plan-Enforcement für Gerki
 *
 * Pläne (JWT `plan`-Wert):
 *   trial    – 14-Tage Testphase → Standard-Features zum Testen
 *   standard – 39,90 €/Mo → 2 Agents (Behördenpost + Dokumente), Ollama
 *   pro      – 59,90 €/Mo → 5 Agents + Cloud-Sync, Ollama
 *   business – 89,90 €/Mo → alle 8 Agents, Cloud-KI (Claude/GPT-4), Multi-User, Cloud-Sync
 *
 * Kein dauerhaft kostenloser Plan! Nur 14-Tage Trial, danach Abo erforderlich.
 *
 * Anti-Cheat:
 *   - Plan kommt ausschließlich aus serverside-signiertem JWT (gerki.app)
 *   - JWT läuft täglich ab, App muss online refreshen
 *   - Offline max. 7 Tage (danach plan = 'expired' bis nächster Verify)
 *   - 1 Trial pro E-Mail (Domain-Blacklist auf Server)
 *   - Gerät-Fingerprint serverside gespeichert
 */

export type Plan = 'trial' | 'standard' | 'pro' | 'business' | 'expired'

export const TRIAL_DAYS = 14

// Welche Skills sind pro Plan erlaubt?
const ALLOWED_SKILLS: Record<Plan, string[]> = {
  trial:    ['general', 'behoerdenpost', 'dokumenten-assistent'],
  standard: ['general', 'behoerdenpost', 'dokumenten-assistent'],
  pro:      ['general', 'behoerdenpost', 'dokumenten-assistent', 'rechtsberater', 'email-manager', 'hr-assistent', 'buchhaltung'],
  business: ['general', 'behoerdenpost', 'dokumenten-assistent', 'rechtsberater', 'email-manager', 'hr-assistent', 'buchhaltung', 'marketing'],
  expired:  []
}

// Welche Modelle sind pro Plan erlaubt?
const ALLOWED_MODELS: Record<Plan, string[]> = {
  trial:    ['ollama'],
  standard: ['ollama'],
  pro:      ['ollama'],
  business: ['ollama', 'claude', 'gpt-4', 'gpt-3.5'],
  expired:  []
}

// Cloud-Sync ab Pro
export const CLOUD_SYNC_PLANS: Plan[] = ['pro', 'business']

const PLAN_NAMES: Record<Plan, string> = {
  trial:    '14-Tage Testphase',
  standard: 'Standard',
  pro:      'Pro',
  business: 'Business',
  expired:  'Abgelaufen'
}

const UPGRADE_HINTS: Record<Plan, string> = {
  trial:    'Wähle einen Plan um nach der Testphase weiterzumachen.',
  standard: 'Upgrade auf Pro (59,90 €/Mo) um diesen Assistenten zu nutzen.',
  pro:      'Upgrade auf Business (89,90 €/Mo) um diesen Assistenten zu nutzen.',
  business: '',
  expired:  'Deine Testphase ist abgelaufen. Wähle einen Plan auf gerki.app um weiterzumachen.'
}

// Max. Offline-Tage bevor Plan auf expired zurückfällt
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
/**
 * Prüft ob Trial abgelaufen ist.
 * trialStartedAt = Timestamp der ersten Registrierung.
 */
export function isTrialExpired(trialStartedAt: number): boolean {
  const daysSinceStart = (Date.now() - trialStartedAt) / (1000 * 60 * 60 * 24)
  return daysSinceStart > TRIAL_DAYS
}

/**
 * Offline-Check + Trial-Check: Gibt effektiven Plan zurück.
 * - Offline > 7 Tage → 'expired'
 * - Trial > 14 Tage → 'expired'
 * - Legacy-Mapping: 'enterprise' → 'business', 'free' → 'trial'
 */
export function getEffectivePlan(plan: string, lastVerifiedAt: number, trialStartedAt?: number): Plan {
  const daysSinceVerify = (Date.now() - lastVerifiedAt) / (1000 * 60 * 60 * 24)
  if (daysSinceVerify > MAX_OFFLINE_DAYS) return 'expired'

  // Legacy-Mappings
  if (plan === 'enterprise') return 'business'
  if (plan === 'free') plan = 'trial'

  // Trial-Ablauf prüfen
  if (plan === 'trial' && trialStartedAt && isTrialExpired(trialStartedAt)) {
    return 'expired'
  }

  return (plan as Plan) in ALLOWED_SKILLS ? (plan as Plan) : 'expired'
}

/**
 * Berechnet verbleibende Trial-Tage.
 */
export function getTrialDaysRemaining(trialStartedAt: number): number {
  const daysSinceStart = (Date.now() - trialStartedAt) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(TRIAL_DAYS - daysSinceStart))
}
