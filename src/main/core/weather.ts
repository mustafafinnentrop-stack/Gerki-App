import { get as httpsGet } from 'https'
import { IncomingMessage } from 'http'

export interface WeatherResult {
  success: boolean
  city?: string
  temperature?: number
  temperatureMax?: number
  temperatureMin?: number
  weatherCode?: number
  windspeed?: number
  description?: string
  error?: string
}

const WMO_CODES: Record<number, string> = {
  0: 'Klarer Himmel',
  1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt',
  45: 'Neblig', 48: 'Gefrierender Nebel',
  51: 'Leichter Nieselregen', 53: 'Mäßiger Nieselregen', 55: 'Starker Nieselregen',
  61: 'Leichter Regen', 63: 'Mäßiger Regen', 65: 'Starker Regen',
  71: 'Leichter Schneefall', 73: 'Mäßiger Schneefall', 75: 'Starker Schneefall',
  80: 'Leichte Schauer', 81: 'Mäßige Schauer', 82: 'Starke Schauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Starkes Gewitter mit Hagel'
}

function fetchJson(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, (res: IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const data = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`
    )
    const json = JSON.parse(data)
    if (json.results?.length > 0) {
      return { lat: json.results[0].latitude, lon: json.results[0].longitude }
    }
  } catch { /* ignore */ }
  return null
}

export async function getWeather(city: string, lat?: string, lon?: string): Promise<WeatherResult> {
  try {
    let latitude = lat ? parseFloat(lat) : NaN
    let longitude = lon ? parseFloat(lon) : NaN

    if (isNaN(latitude) || isNaN(longitude)) {
      const coords = await geocode(city)
      if (!coords) return { success: false, error: `Stadt "${city}" nicht gefunden` }
      latitude = coords.lat
      longitude = coords.lon
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`
    const data = await fetchJson(url)
    const json = JSON.parse(data)

    const code: number = json.current?.weathercode ?? 0
    return {
      success: true,
      city,
      temperature: Math.round(json.current?.temperature_2m ?? 0),
      temperatureMax: Math.round(json.daily?.temperature_2m_max?.[0] ?? 0),
      temperatureMin: Math.round(json.daily?.temperature_2m_min?.[0] ?? 0),
      weatherCode: code,
      windspeed: Math.round(json.current?.windspeed_10m ?? 0),
      description: WMO_CODES[code] ?? 'Unbekannt'
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
