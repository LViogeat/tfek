import { ref } from 'vue'

/**
 * Info à partager à l'arrivée sur la page de l'évènement : le formulaire publie l'info (changement
 * d'heure, de lieu, annulation) puis revient à la page, qui ouvre la feuille de partage.
 * Valable une minute : passé ce délai (page jamais ouverte), on ne la propose plus.
 */
const pending = ref<{ slug: string; body: string; at: number } | null>(null)
const TTL = 60_000

export function setPendingShare(slug: string, body: string) {
  pending.value = { slug, body, at: Date.now() }
}

/** Renvoie le texte à partager pour cet évènement (une seule fois), ou `null`. */
export function takePendingShare(slug: string): string | null {
  const p = pending.value
  if (!p) return null
  if (Date.now() - p.at > TTL) {
    pending.value = null
    return null
  }
  if (p.slug !== slug) return null
  pending.value = null
  return p.body
}
