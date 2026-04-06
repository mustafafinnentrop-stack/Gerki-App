import React, { useState, useEffect } from 'react'
import { User, Crown, Shield, LogOut, Trash2, Eye, EyeOff, Loader2, CheckCircle2, Lock, BarChart2, RefreshCw } from 'lucide-react'

interface UserInfo {
  id: string
  username: string
  email: string
  plan: string
  created_at: string
}

interface UsageInfo {
  plan: string
  used: number
  limit: number
  remaining: number
  percent: number
  month: string
}

interface AccountPageProps {
  user: UserInfo
  onLogout: () => void
}

const PLAN_CONFIG = {
  trial: {
    label: '14-Tage Testphase',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    price: 'Kostenlos',
    features: ['2 Agenten: Behördenpost + Dokumente', 'KI läuft lokal auf deinem PC', 'Memory-System', 'Datei-Indexierung'],
    missing: ['Rechtsberater, E-Mail, HR, Buchhaltung', 'Cloud-Sync', 'Cloud-KI (Claude/GPT-4)']
  },
  standard: {
    label: 'Standard',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    price: '39,90 € / Monat',
    features: ['2 Agenten: Behördenpost + Dokumente', 'Desktop-Automatisierung (Openclaw)', 'KI läuft lokal auf deinem PC', 'Memory-System', 'Datei-Indexierung'],
    missing: ['Rechtsberater, E-Mail, HR, Buchhaltung', 'Cloud-Sync', 'Cloud-KI (Claude/GPT-4)']
  },
  pro: {
    label: 'Pro',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    price: '59,90 € / Monat',
    features: ['5 Agenten: + Rechtsberater, E-Mail, HR, Buchhaltung', 'Desktop-Automatisierung (Openclaw)', 'Cloud-Sync (mehrere Geräte)', 'KI läuft lokal auf deinem PC', 'E-Mail Support 48h'],
    missing: ['Marketing-Agent', 'Cloud-KI (Claude/GPT-4)', 'Multi-User / Team']
  },
  business: {
    label: 'Business',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    price: '89,90 € / Monat',
    features: ['Alle 8 Agenten inkl. Marketing', 'Claude & GPT-4 (Cloud-KI)', 'Cloud-Sync (mehrere Geräte)', 'Multi-User / Team-Accounts', 'Priority Support (24h)'],
    missing: []
  },
  expired: {
    label: 'Abgelaufen',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    price: null,
    features: [],
    missing: ['Alle Funktionen gesperrt — wähle einen Plan um weiterzumachen']
  }
}

export default function AccountPage({ user, onLogout }: AccountPageProps): React.JSX.Element {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  const loadUsage = async () => {
    setUsageLoading(true)
    try {
      const data = await window.gerki.sync.usage()
      setUsage(data)
    } catch {
      // ignore
    } finally {
      setUsageLoading(false)
    }
  }

  useEffect(() => { loadUsage() }, [])

  const planKey = user.plan === 'free' ? 'trial' : user.plan
  const plan = PLAN_CONFIG[planKey as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.expired
  const canUpgrade = user.plan !== 'business'

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwError('Passwörter stimmen nicht überein.')
      return
    }
    setPwError('')
    setPwLoading(true)
    try {
      const result = await window.gerki.auth.changePassword(user.id, oldPassword, newPassword)
      if (result.success) {
        setPwSuccess(true)
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setPwSuccess(false), 3000)
      } else {
        setPwError(result.error ?? 'Fehler beim Ändern des Passworts.')
      }
    } catch {
      setPwError('Ein Fehler ist aufgetreten.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleLogout = async () => {
    await window.gerki.auth.logout()
    onLogout()
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user.username) return
    setDeleteLoading(true)
    try {
      await window.gerki.auth.deleteAccount(user.id)
      onLogout()
    } catch {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mein Konto</h1>
          <p className="text-white/40 text-sm mt-1">Verwalte dein Gerki-Profil und Abonnement</p>
        </div>

        {/* Profile Card */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <User size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">{user.username}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${plan.color} ${plan.bg} ${plan.border}`}>
                  {plan.label}
                </span>
              </div>
              <p className="text-white/40 text-sm truncate">{user.email}</p>
              <p className="text-white/25 text-xs mt-0.5">Mitglied seit {formatDate(user.created_at)}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors text-sm"
            >
              <LogOut size={16} />
              Abmelden
            </button>
          </div>
        </div>

        {/* Plan Section */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={16} className="text-yellow-400" />
            <h3 className="text-white font-medium">Aktuelles Paket</h3>
          </div>

          <div className={`rounded-xl p-4 border ${plan.bg} ${plan.border} mb-4`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`font-semibold text-lg ${plan.color}`}>{plan.label}</span>
              {plan.price && <span className={`text-sm ${plan.color}`}>{plan.price}</span>}
            </div>
            <div className="space-y-1.5">
              {plan.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
              {plan.missing.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-white/25">
                  <Lock size={13} className="flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {canUpgrade && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
              <p className="text-white/80 text-sm font-medium mb-1">
                {user.plan === 'trial' || user.plan === 'free' || user.plan === 'expired'
                  ? 'Plan wählen – ab 39,90 €/Monat'
                  : user.plan === 'standard'
                  ? 'Upgrade auf Pro – 59,90 €/Monat'
                  : 'Upgrade auf Business – 89,90 €/Monat'}
              </p>
              <p className="text-white/40 text-xs mb-3">
                {user.plan === 'trial' || user.plan === 'free' || user.plan === 'expired'
                  ? 'Wähle Standard, Pro oder Business um alle Funktionen dauerhaft zu nutzen.'
                  : user.plan === 'standard'
                  ? 'Schalte Rechtsberater, HR, Buchhaltung & Cloud-Sync frei.'
                  : 'Schalte alle 8 Agenten, Claude/GPT-4 & Multi-User frei.'}
              </p>
              <button
                onClick={() => window.gerki.setup.openRegister()}
                className="w-full bg-primary hover:bg-primary/80 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                Jetzt upgraden auf gerki.app
              </button>
            </div>
          )}
        </div>

        {/* Token-Verbrauch */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-primary" />
              <h3 className="text-white font-medium">Token-Verbrauch</h3>
              {usage && <span className="text-white/30 text-xs">{usage.month}</span>}
            </div>
            <button
              onClick={loadUsage}
              disabled={usageLoading}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
            >
              <RefreshCw size={14} className={usageLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {usageLoading && !usage ? (
            <div className="flex items-center gap-2 text-white/30 text-sm">
              <Loader2 size={14} className="animate-spin" />
              Lade Verbrauch…
            </div>
          ) : usage ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <span className="text-white/50 text-sm">Verbrauchte Tokens</span>
                <span className="text-white font-semibold tabular-nums">
                  {usage.used.toLocaleString('de-DE')}
                  <span className="text-white/30 font-normal text-xs ml-1">/ {usage.limit.toLocaleString('de-DE')}</span>
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    usage.percent >= 90 ? 'bg-red-400' : usage.percent >= 70 ? 'bg-yellow-400' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(usage.percent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${
                  usage.percent >= 90 ? 'text-red-400' : usage.percent >= 70 ? 'text-yellow-400' : 'text-primary'
                }`}>
                  {usage.percent.toFixed(1)} % verbraucht
                </span>
                <span className="text-white/30">{usage.remaining.toLocaleString('de-DE')} verbleibend</span>
              </div>
              {usage.percent >= 90 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                  Kontingent fast erschöpft — erwäge ein Upgrade auf einen höheren Plan.
                </div>
              )}
            </div>
          ) : (
            <p className="text-white/30 text-sm">
              Keine Daten verfügbar — stelle sicher, dass du eingeloggt bist und eine aktive Internetverbindung hast.
            </p>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-white/60" />
            <h3 className="text-white font-medium">Passwort ändern</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-sm text-white/50 mb-1">Aktuelles Passwort</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white text-sm
                             placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Neues Passwort</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                           placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Passwort bestätigen</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                           placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            {pwError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm">{pwError}</div>
            )}
            {pwSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 text-green-400 text-sm flex items-center gap-2">
                <CheckCircle2 size={14} />Passwort erfolgreich geändert.
              </div>
            )}
            <button
              type="submit"
              disabled={pwLoading || !oldPassword || !newPassword || !confirmPassword}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm font-medium
                         px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              {pwLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              Passwort ändern
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-surface border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 size={16} className="text-red-400" />
            <h3 className="text-red-400 font-medium">Konto löschen</h3>
          </div>
          <p className="text-white/50 text-sm mb-4">
            Diese Aktion ist unwiderruflich. Alle deine lokalen Daten, Gespräche, Erinnerungen und Einstellungen werden gelöscht.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-white/50 mb-1">
                Tippe <span className="text-white/80 font-mono">{user.username}</span> zum Bestätigen
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={user.username}
                className="w-full bg-bg border border-red-500/20 rounded-xl px-4 py-2.5 text-white text-sm
                           placeholder:text-white/20 outline-none focus:border-red-500/50 transition-colors"
              />
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== user.username || deleteLoading}
              className="bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 text-red-400 text-sm font-medium
                         px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Konto unwiderruflich löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
