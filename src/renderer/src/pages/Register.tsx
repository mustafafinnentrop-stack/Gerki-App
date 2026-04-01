import React, { useState } from 'react'
import { Bot, Eye, EyeOff, Loader2 } from 'lucide-react'

interface RegisterProps {
  onRegister: (user: { id: string; username: string; email: string; plan: string }) => void
  onGoToLogin: () => void
}

export default function Register({ onRegister, onGoToLogin }: RegisterProps): React.JSX.Element {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !email.trim() || !password) {
      setError('Bitte alle Felder ausfüllen.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const result = await window.gerki.auth.register(username.trim(), email.trim(), password)
      if (result.success && result.user) {
        onRegister(result.user)
      } else {
        setError(result.error ?? 'Registrierung fehlgeschlagen.')
      }
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-bg flex items-center justify-center px-4 overflow-y-auto">
      <div className="w-full max-w-sm py-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
            <Bot size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Konto erstellen</h1>
          <p className="text-white/40 text-sm mt-1">14 Tage kostenlos testen — alle Basis-Funktionen inklusive</p>
        </div>

        {/* Trial badge */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-6 text-center">
          <span className="text-green-400 text-sm font-medium">14 Tage Testphase</span>
          <p className="text-white/40 text-xs mt-0.5">Keine Kreditkarte nötig. Behördenpost & Dokumente inklusive.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Nutzername</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="MeinName"
              autoComplete="username"
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                         placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.de"
              autoComplete="email"
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                         placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">Passwort</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                autoComplete="new-password"
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm
                           placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">Passwort bestätigen</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                         placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !email.trim() || !password || !confirmPassword}
            className="w-full bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-white/30
                       text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Konto wird erstellt...
              </>
            ) : (
              'Konto erstellen'
            )}
          </button>
        </form>

        {/* Login link */}
        <div className="text-center mt-6">
          <span className="text-white/40 text-sm">Bereits ein Konto? </span>
          <button
            onClick={onGoToLogin}
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            Anmelden
          </button>
        </div>

        <p className="text-center text-xs text-white/20 mt-4">
          14 Tage alle Basis-Funktionen testen. Danach Plan wählen.
        </p>
      </div>
    </div>
  )
}
