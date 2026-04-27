import React, { useState, useEffect, useCallback } from 'react'
import { Sun, Newspaper, Calendar, Mic, Plus, Trash2, Save, RefreshCw, MapPin } from 'lucide-react'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

interface Settings {
  routine_enabled: string
  routine_time_start: string
  routine_time_end: string
  routine_items: string      // JSON: string[]
  weather_city: string
  news_feeds: string         // JSON: string[]
  calendar_path: string
  tts_voice_uri: string
  tts_rate: string
}

const DEFAULT_SETTINGS: Settings = {
  routine_enabled: '0',
  routine_time_start: '6',
  routine_time_end: '11',
  routine_items: JSON.stringify(['weather', 'news', 'calendar']),
  weather_city: 'Berlin',
  news_feeds: JSON.stringify(['https://www.tagesschau.de/xml/rss2/']),
  calendar_path: '',
  tts_voice_uri: '',
  tts_rate: '0.95'
}

function parseBool(v: string | undefined) { return v === '1' }
function parseJson<T>(v: string | undefined, fallback: T): T {
  try { return v ? JSON.parse(v) : fallback } catch { return fallback }
}

export default function ProfilePage(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [newFeed, setNewFeed] = useState('')
  const [saved, setSaved] = useState(false)
  const [weatherTest, setWeatherTest] = useState<string | null>(null)
  const [newsTest, setNewsTest] = useState<string | null>(null)
  const [calTest, setCalTest] = useState<string | null>(null)
  const { voices, speak } = useSpeechSynthesis()

  useEffect(() => {
    window.gerki.settings.get().then((raw) => {
      setSettings((prev) => ({ ...prev, ...raw }))
    })
  }, [])

  const save = useCallback(async (s: Settings) => {
    for (const [k, v] of Object.entries(s)) {
      await window.gerki.settings.set(k, v)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  const update = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const toggleRoutineItem = (item: string) => {
    const items: string[] = parseJson(settings.routine_items, ['weather', 'news', 'calendar'])
    const next = items.includes(item) ? items.filter((i) => i !== item) : [...items, item]
    update('routine_items', JSON.stringify(next))
  }

  const routineItems: string[] = parseJson(settings.routine_items, ['weather', 'news', 'calendar'])
  const newsFeeds: string[] = parseJson(settings.news_feeds, ['https://www.tagesschau.de/xml/rss2/'])

  const addFeed = () => {
    if (!newFeed.trim() || newsFeeds.includes(newFeed.trim())) return
    update('news_feeds', JSON.stringify([...newsFeeds, newFeed.trim()]))
    setNewFeed('')
  }

  const removeFeed = (url: string) => {
    update('news_feeds', JSON.stringify(newsFeeds.filter((f) => f !== url)))
  }

  const testWeather = async () => {
    setWeatherTest('Lade...')
    const r = await window.gerki.routine.weather(settings.weather_city)
    if (r.success) {
      setWeatherTest(`${r.temperature}°C, ${r.description} (Min: ${r.temperatureMin}°, Max: ${r.temperatureMax}°)`)
    } else {
      setWeatherTest(`Fehler: ${r.error}`)
    }
  }

  const testNews = async () => {
    setNewsTest('Lade...')
    const r = await window.gerki.routine.news(newsFeeds, 3)
    if (r.success && r.items) {
      setNewsTest(r.items.map((i) => `• ${i.title}`).join('\n'))
    } else {
      setNewsTest(`Fehler: ${r.error}`)
    }
  }

  const testCalendar = async () => {
    setCalTest('Lade...')
    const r = await window.gerki.routine.calendar(settings.calendar_path || undefined)
    if (r.success && r.events) {
      if (r.events.length === 0) {
        setCalTest('Keine Termine heute')
      } else {
        setCalTest(r.events.map((e) => `• ${e.startTime} – ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n'))
      }
    } else {
      setCalTest(`Fehler: ${r.error}`)
    }
  }

  const previewVoice = () => {
    speak('Guten Morgen! Ich bin Gerki, dein persönlicher Assistent.', settings.tts_voice_uri, parseFloat(settings.tts_rate))
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Profil & Routine</h1>
          <p className="text-sm text-white/40 mt-0.5">Personalisiere Gerki und deine Morgen-Routine</p>
        </div>
        <button
          onClick={() => save(settings)}
          className="flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          {saved ? <><RefreshCw size={14} className="animate-spin" /> Gespeichert</> : <><Save size={14} /> Speichern</>}
        </button>
      </div>

      {/* ── Stimme ── */}
      <section className="bg-surface rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Mic size={16} className="text-primary" />
          <h2 className="font-medium text-white">Stimme (TTS)</h2>
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1 block">Stimme</label>
          <select
            value={settings.tts_voice_uri}
            onChange={(e) => update('tts_voice_uri', e.target.value)}
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
          >
            <option value="">Automatisch (beste deutsche Stimme)</option>
            {voices
              .filter((v) => v.lang.startsWith('de'))
              .map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} {v.localService ? '(lokal)' : '(online)'}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1 block">Geschwindigkeit: {settings.tts_rate}×</label>
          <input
            type="range" min="0.5" max="1.5" step="0.05"
            value={settings.tts_rate}
            onChange={(e) => update('tts_rate', e.target.value)}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-white/30 mt-0.5">
            <span>Langsam</span><span>Normal</span><span>Schnell</span>
          </div>
        </div>

        <button
          onClick={previewVoice}
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          Vorschau abspielen
        </button>
      </section>

      {/* ── Morgen-Routine ── */}
      <section className="bg-surface rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun size={16} className="text-yellow-400" />
            <h2 className="font-medium text-white">Morgen-Routine</h2>
          </div>
          <button
            onClick={() => update('routine_enabled', parseBool(settings.routine_enabled) ? '0' : '1')}
            className={`relative w-10 h-5 rounded-full transition-colors ${parseBool(settings.routine_enabled) ? 'bg-primary' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${parseBool(settings.routine_enabled) ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {parseBool(settings.routine_enabled) && (
          <>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-white/40 mb-1 block">Von (Uhr)</label>
                <input
                  type="number" min="0" max="23"
                  value={settings.routine_time_start}
                  onChange={(e) => update('routine_time_start', e.target.value)}
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-white/40 mb-1 block">Bis (Uhr)</label>
                <input
                  type="number" min="0" max="23"
                  value={settings.routine_time_end}
                  onChange={(e) => update('routine_time_end', e.target.value)}
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-2 block">Routine-Inhalte</label>
              <div className="flex gap-2 flex-wrap">
                {([['weather', 'Wetter', '☀️'], ['news', 'Nachrichten', '📰'], ['calendar', 'Kalender', '📅']] as const).map(([id, label, icon]) => (
                  <button
                    key={id}
                    onClick={() => toggleRoutineItem(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${routineItems.includes(id) ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-white/40 border border-white/10'}`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Wetter ── */}
      <section className="bg-surface rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sun size={16} className="text-orange-400" />
          <h2 className="font-medium text-white">Wetter</h2>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-white/40 mb-1 block">Stadt</label>
            <div className="flex gap-2">
              <input
                value={settings.weather_city}
                onChange={(e) => update('weather_city', e.target.value)}
                placeholder="z.B. Berlin"
                className="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={testWeather}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <MapPin size={14} /> Test
              </button>
            </div>
          </div>
        </div>
        {weatherTest && (
          <div className="bg-bg rounded-lg p-3 text-sm text-white/70 whitespace-pre-line">{weatherTest}</div>
        )}
      </section>

      {/* ── News ── */}
      <section className="bg-surface rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-blue-400" />
          <h2 className="font-medium text-white">Nachrichten (RSS)</h2>
        </div>

        <div className="space-y-2">
          {newsFeeds.map((feed) => (
            <div key={feed} className="flex items-center gap-2 bg-bg rounded-lg px-3 py-2">
              <span className="flex-1 text-xs text-white/60 truncate">{feed}</span>
              <button onClick={() => removeFeed(feed)} className="text-white/20 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={newFeed}
            onChange={(e) => setNewFeed(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFeed()}
            placeholder="RSS-Feed URL hinzufügen..."
            className="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50"
          />
          <button onClick={addFeed} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        </div>

        <button
          onClick={testNews}
          className="text-sm text-blue-400/70 hover:text-blue-400 transition-colors"
        >
          Feeds testen
        </button>
        {newsTest && (
          <div className="bg-bg rounded-lg p-3 text-sm text-white/70 whitespace-pre-line">{newsTest}</div>
        )}
      </section>

      {/* ── Kalender ── */}
      <section className="bg-surface rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-green-400" />
          <h2 className="font-medium text-white">Kalender</h2>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300/80 space-y-1">
          <p><strong>macOS:</strong> Kalender.app wird automatisch abgefragt (Berechtigung beim ersten Mal nötig)</p>
          <p><strong>Windows / Linux:</strong> Exportiere deinen Kalender als .ics-Datei und hinterlege den Pfad hier</p>
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1 block">Pfad zur .ics-Datei (optional)</label>
          <input
            value={settings.calendar_path}
            onChange={(e) => update('calendar_path', e.target.value)}
            placeholder="/home/user/kalender.ics"
            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/50"
          />
        </div>

        <button
          onClick={testCalendar}
          className="text-sm text-green-400/70 hover:text-green-400 transition-colors"
        >
          Heute's Termine abrufen
        </button>
        {calTest && (
          <div className="bg-bg rounded-lg p-3 text-sm text-white/70 whitespace-pre-line">{calTest}</div>
        )}
      </section>
    </div>
  )
}
