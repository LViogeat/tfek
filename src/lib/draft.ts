import type { EventInput } from './events'

const KEY = 'tfek.draftEvent'

export interface Draft extends EventInput {
  publishAfterLogin?: boolean
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
