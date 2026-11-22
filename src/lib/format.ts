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
      : ` → ${capitalize(dateFmt.format(end))} à ${timeFmt.format(end)}`
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

const dayShortFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })

/** Date façon billet : « MAR 01.12 ». */
export function ticketDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = dayShortFmt.format(d).replace('.', '').toUpperCase()
  return `${day} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}`
}

/** Heure façon billet : « 20:00 » ou « 20:00 – 23:00 ». `null` si l'event dure plusieurs jours. */
export function ticketTime(startsAt: string, endsAt?: string | null): string | null {
  const start = new Date(startsAt)
  if (!endsAt) return timeFmt.format(start)
  const end = new Date(endsAt)
  if (start.toDateString() !== end.toDateString()) return null
  return `${timeFmt.format(start)} – ${timeFmt.format(end)}`
}

/** Découpe « Alex, Inès et Sam » (virgules, retours à la ligne, « et ») en prénoms. */
export function parseNames(text: string): string[] {
  return text
    .split(/[,;\n]|\s+et\s+/i)
    .map((n) => n.trim())
    .filter(Boolean)
}

/** « Alex », « Alex et Inès », « Alex, Inès et Sam ». */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}

/** « samedi 6 décembre à 20:00 », sans majuscule, pour le milieu d'une phrase. */
function dayAndTime(d: Date): string {
  return `${dateFmt.format(d)} à ${timeFmt.format(d)}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

export interface ChangeFields {
  starts_at: string
  ends_at: string | null
  location: string | null
}

/**
 * Texte de l'info publiée quand l'organisateur change la date, l'heure ou le lieu :
 * une ligne par changement, avec l'ancienne valeur. `null` si rien d'important n'a changé.
 */
export function changeSummary(before: ChangeFields, after: ChangeFields): string | null {
  const lines: string[] = []
  const b = new Date(before.starts_at)
  const a = new Date(after.starts_at)
  if (a.getTime() !== b.getTime()) {
    if (sameDay(a, b)) {
      lines.push(`Nouvelle heure : ${dayAndTime(a)} (au lieu de ${timeFmt.format(b)})`)
    } else {
      const sameTime = timeFmt.format(a) === timeFmt.format(b)
      lines.push(`Nouvelle date : ${dayAndTime(a)} (au lieu du ${sameTime ? dateFmt.format(b) : dayAndTime(b)})`)
    }
  }

  const endBefore = before.ends_at ? new Date(before.ends_at).getTime() : null
  const endAfter = after.ends_at ? new Date(after.ends_at) : null
  if ((endAfter?.getTime() ?? null) !== endBefore) {
    if (!endAfter) lines.push('Plus d’heure de fin')
    else lines.push(`Fin : ${sameDay(endAfter, a) ? timeFmt.format(endAfter) : dayAndTime(endAfter)}`)
  }

  const placeBefore = before.location?.trim() || null
  const placeAfter = after.location?.trim() || null
  if (placeAfter !== placeBefore) {
    if (!placeAfter) lines.push('Lieu à préciser')
    else if (!placeBefore) lines.push(`Lieu : ${placeAfter}`)
    else lines.push(`Nouveau lieu : ${placeAfter} (au lieu de ${placeBefore})`)
  }

  return lines.length ? lines.join('\n') : null
}

/** Décale une date de `weeks` semaines, à la même heure locale (changements d'heure compris). */
export function shiftWeeks(iso: string, weeks: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + 7 * weeks)
  return d.toISOString()
}

/** Dupliquer : nombre de semaines (au moins 1) pour que la copie tombe dans le futur. */
export function weeksUntilFuture(startsAt: string, now = Date.now()): number {
  let weeks = 1
  while (new Date(shiftWeeks(startsAt, weeks)).getTime() <= now) weeks++
  return weeks
}
