// Thèmes des billets : chaque event a un fond sombre et une couleur d'accent.
// Les identifiants doivent rester alignés avec la contrainte `events.theme` (migration init).

export type ThemeId = 'braise' | 'marine' | 'foret' | 'rouge' | 'acier' | 'sable'

export interface EventTheme {
  id: ThemeId
  label: string
  /** Fond de la page */
  bg: string
  /** Couleur du bandeau, des boutons choisis et des détails */
  accent: string
}

export const THEMES: EventTheme[] = [
  { id: 'braise', label: 'Braise', bg: '#1B1E21', accent: '#FF6A1A' },
  { id: 'marine', label: 'Marine', bg: '#0F2A44', accent: '#FFC23A' },
  { id: 'foret', label: 'Forêt', bg: '#12301F', accent: '#B8E04A' },
  { id: 'rouge', label: 'Rouge', bg: '#1C1517', accent: '#FF4D4D' },
  { id: 'acier', label: 'Acier', bg: '#20252B', accent: '#6EC1FF' },
  { id: 'sable', label: 'Sable', bg: '#2A231B', accent: '#E9C46A' },
]

export const DEFAULT_THEME: ThemeId = 'braise'

export function getTheme(id: string | null | undefined): EventTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** Variables CSS à poser sur la page d'un event (recolore aussi les composants Ionic). */
export function themeStyle(id: string | null | undefined): Record<string, string> {
  const t = getTheme(id)
  // Les variables Ionic sont redéfinies ici aussi : une variable CSS qui en référence une autre
  // est résolue là où elle est déclarée, pas là où elle est utilisée.
  return {
    '--t-bg': t.bg,
    '--t-accent': t.accent,
    '--ion-background-color': t.bg,
    '--ion-background-color-rgb': rgb(t.bg),
    '--ion-toolbar-background': t.bg,
    '--ion-color-primary': t.accent,
    '--ion-color-primary-rgb': rgb(t.accent),
    '--ion-color-primary-shade': t.accent,
    '--ion-color-primary-tint': t.accent,
  }
}
