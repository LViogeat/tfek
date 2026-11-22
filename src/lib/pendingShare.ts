import { ref } from 'vue'

/**
 * Info à partager à l'arrivée sur la page de l'évènement : le formulaire publie l'info (changement
 * d'heure, de lieu, annulation) puis revient à la page, qui ouvre la feuille de partage.
 */
export const pendingShare = ref<{ slug: string; body: string } | null>(null)
