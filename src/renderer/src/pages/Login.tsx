import React, { useState } from 'react'
import { Bot, Eye, EyeOff, Loader2 } from 'lucide-react'

interface LoginProps {
  onLogin: (user: { id: string; username: string; email: string; plan: string }) => void
}

export default function Login({ onLogin }: LoginProps): React.JSX.Element {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Login state
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Register state
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailOrUsername.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      const result = await window.gerki.auth.login(emailOrUsername.trim(), password)
      if (result.success && result.user) {
        onLogin(result.user)
      } else {
        setError(result.error ?? 'Anmeldung fehlgeschlagen.')
      }
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regUsername.trim() || !regEmail.trim() || !regPassword) return
    if (regPassword !== regPassword2) {
      setError('Passwörter stimmen nicht überein.')
      return
    }
    if (regPassword.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen haben.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await window.gerki.auth.register(regUsername.trim(), regEmail.trim(), regPassword)
      if (result.success && result.user) {
        onLogin(result.user)
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
    <div className="h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
            <Bot size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Willkommen bei Gerki</h1>
          <p className="text-white/40 text-sm mt-1">Deine persönliche KI – lokal & privat</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-surface rounded-xl p-1 mb-6 border border-white/5">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-primary text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Anmelden
          </button>
          <button
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-primary text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            Registrieren
          </button>
        </div>

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">E-Mail oder Nutzername</label>
              <input
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="du@beispiel.de"
                autoComplete="username"
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
                  placeholder="••••••••"
                  autoComplete="current-password"
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

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !emailOrUsername.trim() || !password}
              className="w-full bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-white/30
                         text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />Anmelden...</> : 'Anmelden'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Nutzername</label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="maxmustermann"
                autoComplete="username"
                className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                           placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">E-Mail</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
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
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  autoComplete="new-password"
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm
                             placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Passwort bestätigen</label>
              <input
                type={showRegPassword ? 'text' : 'password'}
                value={regPassword2}
                onChange={(e) => setRegPassword2(e.target.value)}
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
              disabled={loading || !regUsername.trim() || !regEmail.trim() || !regPassword || !regPassword2}
              className="w-full bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-white/30
                         text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />Registrieren...</> : 'Konto erstellen'}
            </button>

            <p className="text-center text-xs text-white/20 pt-1">
              Dein Konto wird lokal auf diesem Gerät gespeichert.
            </p>
          </form>
        )}

        <p className="text-center text-xs text-white/20 mt-6">
          Gespräche & Dateien bleiben lokal auf deinem PC.
        </p>
      </div>
    </div>
  )
}
