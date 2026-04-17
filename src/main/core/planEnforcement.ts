/**
 * Plan-Enforcement für Gerki
 *
 * Gerki ist lokal-first: Das KI-Modell ist immer Ollama (lokal).
 * Plan-Unterschiede betreffen nur den Zugang zu spezialisierten Agenten.
 *
 * Pläne (intern):
 *   trial    – 14-Tage Testphase mit Basic-Agenten
 *   standard – Basic  (39,90 €/Mo) → 3 spezialisierte Agenten
 *   pro      – Pro    (59,90 €/Mo) → 5 spezialisierte Agenten
 *   business – Business (89,90 €/Mo) → alle 8 Agenten
 *   expired  – Abgelaufen → gesperrt
 *
 * Agenten pro Plan:
 *   Basic:    Allgemein, Behördenpost, Dokumenten-Assistent, E-Mail-Manager
 *   Pro:      + HR-Assistent, Rechtsberater
 *   Business: + Buchhaltung, Marketing
 *
 * Anti-Cheat:
 *   - Plan kommt aus serverside-signiertem JWT (gerki.app)
 *   - Offline max. 7 Tage (danach plan → 'expired' bis nächster Verify)
 *   - 1 Trial pro E-Mail (Server-seitig)
 */

export type Plan = 'trial' | 'standard' | 'pro' | 'business' | 'expired'

export const TRIAL_DAYS = 14

// ── Basic (trial + standard): Allgemein + 3 spezialisierte Agenten ──────────
const BASIC_SKILLS = ['general', 'behoerdenpost', 'dokumenten-assistent', 'email-manager']
// ── Pro: Basic + HR + Rechtsberater ─────────────────────────────────────────
const PRO_SKILLS = [...BASIC_SKILLS, 'hr-assistent', 'rechtsberater']
// ── Business: alle 8 Agenten ─────────────────────────────────────────────────
const BUSINESS_SKILLS = [...PRO_SKILLS, 'buchhaltung', 'marketing']

const ALLOWED_SKILLS: Record<Plan, string[]> = {
  trial:    BASIC_SKILLS,
  standard: BASIC_SKILLS,
  pro:      PRO_SKILLS,
  business: BUSINESS_SKILLS,
  expired:  []
}

// Modell ist immer Ollama – lokale KI, keine Cloud
const ALLOWED_MODELS: Record<Plan, string[]> = {
  trial:    ['ollama'],
  standard: ['ollama'],
  pro:      ['ollama'],
  business: ['ollama'],
  expired:  []
}

const PLAN_NAMES: Record<Plan, string> = {
  trial:    '14-Tage Testphase',
  standard: 'Standard',
  pro:      'Pro',
  business: 'Business',
  expired:  'Abgelaufen'
}

const UPGRADE_HINTS: Record<Plan, string> = {
  trial:    'Upgrade auf Standard um mehr Agenten zu nutzen.',
  standard: 'Upgrade auf Pro (59,90 €/Mo) für alle Agenten.',
  pro:      'Du hast Zugang zu allen Agenten.',
  business: '',
  expired:  'Deine Testphase ist abgelaufen. Wähle einen Plan auf gerki.app um weiterzumachen.'
}

// Max. Offline-Tage bevor Plan auf expired zurückfällt
export const MAX_OFFLINE_DAYS = 7
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
    return {
      allowed: false,
      error: `Das Modell "${model}" ist nicht verfügbar.`
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
export function getEffectivePlan(plan: string, lastVerifiedAt: number, trialStartedAt?: number): Plan {
  const daysSinceVerify = (Date.now() - lastVerifiedAt) / (1000 * 60 * 60 * 24)
  if (daysSinceVerify > MAX_OFFLINE_DAYS) return 'expired'

  if (plan === 'enterprise') return 'business'
  if (plan === 'free') plan = 'trial'

  if (plan === 'trial' && trialStartedAt && isTrialExpired(trialStartedAt)) {
    return 'expired'
  }

  return (plan as Plan) in ALLOWED_SKILLS ? (plan as Plan) : 'expired'
}

export function getOfflineWarning(lastVerifiedAt: number): { daysRemaining: number; warn: boolean } | null {
  const daysSinceVerify = (Date.now() - lastVerifiedAt) / (1000 * 60 * 60 * 24)
  const daysRemaining = Math.max(0, Math.ceil(MAX_OFFLINE_DAYS - daysSinceVerify))

  if (daysSinceVerify <= OFFLINE_WARNING_DAYS) return null
  if (daysRemaining <= 0) return { daysRemaining: 0, warn: true }

  return { daysRemaining, warn: true }
}
