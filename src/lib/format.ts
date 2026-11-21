const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const relFmt = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatEventDate(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt)
  let out = `${capitalize(dateFmt.format(start))} à ${timeFmt.format(start)}`
  if (endsAt) {
    const end = new Date(endsAt)
    out += start.toDateString() === end.toDateString()
      ? ` – ${timeFmt.format(end)}`
      : ` → ${dateFmt.format(end)} à ${timeFmt.format(end)}`
  }
  return out
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return `${capitalize(shortFmt.format(d))} · ${timeFmt.format(d)}`
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return 'à l’instant'
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), 'hour')
  return relFmt.format(Math.round(diff / 86400), 'day')
}

/** Convertit une date ISO en valeur locale pour ion-datetime (sans fuseau). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}
