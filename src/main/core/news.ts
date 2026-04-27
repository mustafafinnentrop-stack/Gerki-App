import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'
import { IncomingMessage } from 'http'

export interface NewsItem {
  title: string
  description: string
  link: string
  pubDate: string
}

export const DEFAULT_FEEDS = [
  'https://www.tagesschau.de/xml/rss2/'
]

function fetchUrl(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'))
    const getter = url.startsWith('https') ? httpsGet : httpGet
    const req = getter(url, (res: IncomingMessage) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, redirects + 1).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.setEncoding('utf-8')
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim()
}

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
      return m ? stripCdata(m[1]) : ''
    }
    const title = get('title')
    if (!title) continue
    items.push({
      title,
      description: get('description').slice(0, 200),
      link: get('link'),
      pubDate: get('pubDate')
    })
  }
  return items
}

export async function getNews(feedUrls?: string[], count = 5): Promise<{
  success: boolean
  items?: NewsItem[]
  error?: string
}> {
  const urls = feedUrls && feedUrls.length > 0 ? feedUrls : DEFAULT_FEEDS
  const allItems: NewsItem[] = []

  for (const url of urls) {
    try {
      const xml = await fetchUrl(url)
      allItems.push(...parseRSS(xml).slice(0, count))
    } catch { /* skip failed feeds */ }
  }

  if (allItems.length === 0) return { success: false, error: 'Keine Nachrichten verfügbar' }
  return { success: true, items: allItems.slice(0, count) }
}
