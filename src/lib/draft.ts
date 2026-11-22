import type { EventInput } from './events'

const KEY = 'tfek.draftEvent'

export interface Draft extends EventInput {
  publishAfterLogin?: boolean
  /** Identifiant unique du brouillon, enregistré avec l'évènement pour ne le publier qu'une fois */
  draftId?: string
}

export function saveDraft(d: Draft) {
  localStorage.setItem(KEY, JSON.stringify(d))
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function clearDraft() {
  localStorage.removeItem(KEY)
}
