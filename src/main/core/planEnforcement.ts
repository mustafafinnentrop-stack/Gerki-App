/**
 * Plan-Enforcement für Gerki
 *
 * Pläne:
 *   trial      – 14-Tage Testphase (nach Registrierung)
 *   standard   – 39,90 €/Mo → Ollama, 2 Agenten (Behördenpost + Dokumente)
 *   pro        – 59,90 €/Mo → Ollama, 5 Agenten + Cloud-Sync
 *   business   – 89,90 €/Mo → Alle Modelle (Claude, GPT-4), alle 8 Agenten + Cloud-Sync
 *   expired    – Trial abgelaufen oder Abo gekündigt → alles gesperrt
 *
 * Anti-Cheat:
 *   - Plan kommt aus serverside-signiertem JWT (gerki.app)
 *   - JWT läuft täglich ab, App muss online refreshen
 *   - Offline max. 7 Tage (danach plan → 'expired' bis nächster Verify)
 *   - 1 Trial pro E-Mail (Server-seitig)
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

<<<<<<< HEAD
// Cloud-Sync nur ab Pro
export const CLOUD_SYNC_PLANS: Plan[] = ['pro', 'business']

const PLAN_NAMES: Record<Plan, string> = {
  trial:    'Testphase',
=======
// Cloud-Sync ab Pro
export const CLOUD_SYNC_PLANS: Plan[] = ['pro', 'business']

const PLAN_NAMES: Record<Plan, string> = {
  trial:    '14-Tage Testphase',
>>>>>>> origin/main
  standard: 'Standard',
  pro:      'Pro',
  business: 'Business',
  expired:  'Abgelaufen'
}

const UPGRADE_HINTS: Record<Plan, string> = {
<<<<<<< HEAD
  trial:    'Wähle einen Plan ab 39,90 €/Mo unter gerki.app/preise.',
  standard: 'Upgrade auf Pro (59,90 €/Mo) für mehr Agenten.',
  pro:      'Upgrade auf Business (89,90 €/Mo) für Claude & GPT-4.',
  business: '',
  expired:  'Dein Zugang ist abgelaufen. Wähle einen Plan unter gerki.app/preise.'
=======
  trial:    'Wähle einen Plan um nach der Testphase weiterzumachen.',
  standard: 'Upgrade auf Pro (59,90 €/Mo) um diesen Assistenten zu nutzen.',
  pro:      'Upgrade auf Business (89,90 €/Mo) um diesen Assistenten zu nutzen.',
  business: '',
  expired:  'Deine Testphase ist abgelaufen. Wähle einen Plan auf gerki.app um weiterzumachen.'
>>>>>>> origin/main
}

// Max. Offline-Tage bevor Plan auf expired zurückfällt
export const MAX_OFFLINE_DAYS = 7

// Ab wann Warnung anzeigen (Tage vor Ablauf)
export const OFFLINE_WARNING_DAYS = 5

export function isTrialExpired(trialStartedAt: number): boolean {
  const daysSinceStart = (Date.now() - trialStartedAt) / (1000 * 60 * 60 * 24)
  return daysSinceStart > TRIAL_DAYS
}

export function getTrialDaysRemaining(trialStartedAt: number): number {
  const daysSinceStart = (Date.now() - trialStartedAt) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(TRIAL_DAYS - daysSinceStart))
}

export function isSkillAllowed(plan: string, skillSlug: string): boolean {
  const p = (plan as Plan) in ALLOWED_SKILLS ? (plan as Plan) : 'expired'
  return ALLOWED_SKILLS[p].includes(skillSlug)
}

export function isModelAllowed(plan: string, model: string): boolean {
  const p = (plan as Plan) in ALLOWED_MODELS ? (plan as Plan) : 'expired'
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
  if (plan === 'expired') {
    return {
      allowed: false,
      error: 'Dein Zugang ist abgelaufen. Bitte wähle einen Plan unter gerki.app/preise.'
    }
  }
  if (!isSkillAllowed(plan, skillSlug)) {
    const hint = getUpgradeHint(plan)
    return {
      allowed: false,
      error: `Der Agent "${skillSlug}" ist in deinem ${getPlanName(plan)}-Plan nicht verfügbar. ${hint}`
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
 * Offline-Degradierung: Gibt den effektiven Plan zurück.
 * - Offline > 7 Tage → 'expired'
 * - Trial > 14 Tage → 'expired'
 * - Legacy-Mapping: 'free' → 'trial', 'enterprise' → 'business'
 */
<<<<<<< HEAD
export function getEffectivePlan(plan: string, lastVerifiedAt: number, trialStartedAt?: number): Plan {
  // Legacy-Mapping
  if (plan === 'free') plan = 'trial'
  if (plan === 'enterprise') plan = 'business'
=======
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
>>>>>>> origin/main

  // Trial-Ablauf prüfen
  if (plan === 'trial' && trialStartedAt && isTrialExpired(trialStartedAt)) {
    return 'expired'
  }

<<<<<<< HEAD
  // Offline zu lange → expired
  const daysSinceVerify = (Date.now() - lastVerifiedAt) / (1000 * 60 * 60 * 24)
  if (daysSinceVerify > MAX_OFFLINE_DAYS) return 'expired'

=======
>>>>>>> origin/main
  return (plan as Plan) in ALLOWED_SKILLS ? (plan as Plan) : 'expired'
}

/**
<<<<<<< HEAD
 * Offline-Warnung: Gibt Tage bis Ablauf zurück (null = kein Problem)
 * Zeigt Warnung wenn < OFFLINE_WARNING_DAYS verbleiben.
 */
export function getOfflineWarning(lastVerifiedAt: number): { daysRemaining: number; warn: boolean } | null {
  const daysSinceVerify = (Date.now() - lastVerifiedAt) / (1000 * 60 * 60 * 24)
  const daysRemaining = Math.max(0, Math.ceil(MAX_OFFLINE_DAYS - daysSinceVerify))

  if (daysSinceVerify <= OFFLINE_WARNING_DAYS) return null // Noch kein Problem
  if (daysRemaining <= 0) return { daysRemaining: 0, warn: true }

  return { daysRemaining, warn: true }
=======
 * Berechnet verbleibende Trial-Tage.
 */
export function getTrialDaysRemaining(trialStartedAt: number): number {
  const daysSinceStart = (Date.now() - trialStartedAt) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(TRIAL_DAYS - daysSinceStart))
>>>>>>> origin/main
}
