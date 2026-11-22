// Empreinte de l'aperçu du lien, partagée entre l'app (lien partagé) et les fonctions Vercel (image).
// Logique pure, sans dépendance.

/** Ce que renvoie la RPC get_event à un visiteur sans session (counts = null si masqués). */
export interface PreviewEvent {
  slug: string
  title: string
  starts_at: string
  ends_at: string | null
  location: string | null
  theme: string
  show_guest_list: boolean
  show_counts: boolean
  cancelled_at: string | null
  organizer_name: string
  counts: { going: number; maybe: number; declined: number } | null
}

export interface PreviewGuest {
  display_name: string
  status: 'going' | 'maybe' | 'declined'
}

/** Prénoms des premiers qui viennent, uniquement si la liste est publique. */
export function goingNames(event: PreviewEvent, guests: PreviewGuest[]): string[] {
  if (!event.show_guest_list) return []
  return guests
    .filter((g) => g.status === 'going')
    .map((g) => g.display_name.trim().split(/\s+/)[0] ?? '')
    .filter(Boolean)
}

/** Les réponses s'affichent si l'organisateur l'a choisi et qu'au moins une personne vient. */
export function showResponses(event: PreviewEvent): boolean {
  return !event.cancelled_at && !!event.counts && event.counts.going > 0
}

/** Empreinte courte du contenu de l'image : change dès que l'image change (cache des messageries). */
export function imageVersion(event: PreviewEvent, names: string[]): string {
  const key = JSON.stringify([
    event.title, event.starts_at, event.location, event.theme, !!event.cancelled_at,
    showResponses(event) ? [event.counts!.going, event.counts!.maybe, names.slice(0, 3)] : null,
  ])
  // FNV-1a 32 bits
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}
