import React, { useState } from 'react'
import { User, Crown, Shield, LogOut, Trash2, Eye, EyeOff, Loader2, CheckCircle2, Lock } from 'lucide-react'

interface UserInfo {
  id: string
  username: string
  email: string
  plan: string
  created_at: string
}

interface AccountPageProps {
  user: UserInfo
  onLogout: () => void
}

const PLAN_CONFIG = {
  free: {
    label: 'Testversion',
    color: 'text-white/60',
    bg: 'bg-white/10',
    border: 'border-white/10',
    price: null,
    features: ['Ollama (lokale KI, offline)', 'Allgemeiner Assistent', 'Memory-System', 'Datei-Indexierung'],
    missing: ['Behördenpost & Dokumente', 'Claude & GPT-4', 'Cloud-Sync']
  },
  standard: {
    label: 'Standard',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    price: '39,90 € / Monat',
    features: ['Ollama (lokale KI, offline)', 'Openclaw (Desktop-Automatisierung)', '2 Agents: Behördenpost + Dokumente', 'Memory-System', 'Datei-Indexierung'],
    missing: ['Claude & GPT-4', 'Cloud-Sync', 'Rechtsberater, E-Mail, HR-Assistent']
  },
  pro: {
    label: 'Standard',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    price: '39,90 € / Monat',
    features: ['Ollama (lokale KI, offline)', 'Openclaw (Desktop-Automatisierung)', '2 Agents: Behördenpost + Dokumente', 'Memory-System'],
    missing: ['Claude & GPT-4', 'Cloud-Sync']
  },
  business: {
    label: 'Business',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    price: '69,90 € / Monat',
    features: ['Alles aus Standard', 'Claude (Anthropic) & GPT-4', '5 Agents: + Rechtsberater, E-Mail, HR, Buchhaltung', 'Cloud-Sync (mehrere Geräte)', 'E-Mail Support 48h'],
    missing: ['Marketing-Agent', 'Multi-User / Team']
  },
  enterprise: {
    label: 'Enterprise',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    price: 'Auf Anfrage',
    features: ['Alles aus Business', 'Alle 8 Agents', 'Multi-User / Team-Accounts', 'Individuelle Einrichtung', 'Priority Support (24h, Telefon)'],
    missing: []
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

  const plan = PLAN_CONFIG[user.plan as keyof typeof PLAN_CONFIG] ?? PLAN_CONFIG.free
  const canUpgrade = user.plan === 'free' || user.plan === 'standard' || user.plan === 'pro'

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
                {user.plan === 'free' ? 'Upgrade auf Standard – 39,90 €/Monat' : 'Upgrade auf Business – 69,90 €/Monat'}
              </p>
              <p className="text-white/40 text-xs mb-3">
                {user.plan === 'free'
                  ? 'Starte jetzt mit Behördenpost & Dokumenten-Assistent. 14 Tage kostenlos testen.'
                  : 'Erhalte Zugang zu Claude & GPT-4 sowie 5 Agents. Cloud-Sync inklusive.'}
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
