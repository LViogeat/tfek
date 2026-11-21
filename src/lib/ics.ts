import { Capacitor } from '@capacitor/core'

export interface IcsEvent {
  slug: string
  title: string
  description?: string | null
  location?: string | null
  starts_at: string
  ends_at?: string | null
  url: string
}

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Échappement d'une valeur TEXT (RFC 5545 §3.3.11). */
export function escapeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** Plie une ligne à 75 octets (RFC 5545 §3.1) sans couper un caractère UTF-8. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    // 75 octets pour la première ligne, 74 + l'espace de continuation ensuite
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function buildIcs(e: IcsEvent): string {
  const end = e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 2 * 3600 * 1000).toISOString()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//tfek//FR',
    'BEGIN:VEVENT',
    `UID:${e.slug}@tfek`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(e.starts_at)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText([e.description ?? '', e.url].filter(Boolean).join('\n\n'))}`,
    e.location ? `LOCATION:${escapeText(e.location)}` : '',
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export async function downloadIcs(e: IcsEvent) {
  const content = buildIcs(e)
  const filename = `${e.slug}.ics`

  if (Capacitor.isNativePlatform()) {
    // Les WebViews natives ignorent les liens blob: + download : on écrit le fichier
    // puis on ouvre la feuille de partage (qui propose l'agenda).
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({ title: e.title, files: [uri] })
    return
  }

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
