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

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;')
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
    `SUMMARY:${escape(e.title)}`,
    `DESCRIPTION:${escape([e.description ?? '', e.url].filter(Boolean).join('\n\n'))}`,
    e.location ? `LOCATION:${escape(e.location)}` : '',
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n')
}

export function downloadIcs(e: IcsEvent) {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${e.slug}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
