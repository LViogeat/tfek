// Thèmes des billets : couleurs profondes, détails dorés.
// Les identifiants doivent rester alignés avec la contrainte `events.theme` (migration init).

export type ThemeId = 'noir' | 'bordeaux' | 'vert' | 'nuit' | 'terre' | 'ivoire'

export interface EventTheme {
  id: ThemeId
  label: string
  /** Fond de la page */
  bg: string
  /** Bandeau du billet et texte posé dessus */
  band: string
  bandText: string
  /** Tampon et numéro sur le bandeau */
  stamp: string
  /** Couleur d'accent de l'interface (bouton choisi, liens, liseré des infos) et texte posé dessus */
  accent: string
  onAccent: string
}

const INK = '#1A1714'
const CREAM = '#F4EFE6'

export const THEMES: EventTheme[] = [
  { id: 'noir', label: 'Noir et or', bg: '#100F0E', band: '#1A1816', bandText: CREAM, stamp: '#C9A96E', accent: '#C9A96E', onAccent: INK },
  { id: 'bordeaux', label: 'Bordeaux', bg: '#1E0F11', band: '#5B1F27', bandText: CREAM, stamp: '#E3C79B', accent: '#E3C79B', onAccent: INK },
  { id: 'vert', label: 'Vert anglais', bg: '#0E1A14', band: '#1E3A2C', bandText: CREAM, stamp: '#C9A96E', accent: '#C9A96E', onAccent: INK },
  { id: 'nuit', label: 'Bleu nuit', bg: '#0E1322', band: '#1C2742', bandText: CREAM, stamp: '#D8C4A0', accent: '#D8C4A0', onAccent: INK },
  { id: 'terre', label: 'Terre cuite', bg: '#22130E', band: '#8E4630', bandText: CREAM, stamp: '#F1E3C8', accent: '#F1E3C8', onAccent: INK },
  // Version claire : bandeau ivoire, tampon bordeaux ; l'interface garde un accent ivoire lisible sur fond sombre
  { id: 'ivoire', label: 'Ivoire', bg: '#1A1714', band: '#E6DDCC', bandText: INK, stamp: '#7A2E2E', accent: '#E6DDCC', onAccent: INK },
]

export const DEFAULT_THEME: ThemeId = 'noir'

export function getTheme(id: string | null | undefined): EventTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** Variables CSS à poser sur une page (recolore aussi les composants Ionic). */
export function themeStyle(id: string | null | undefined): Record<string, string> {
  const t = getTheme(id)
  // Les variables Ionic sont redéfinies ici aussi : une variable CSS qui en référence une autre
  // est résolue là où elle est déclarée, pas là où elle est utilisée.
  return {
    '--t-bg': t.bg,
    '--t-band': t.band,
    '--t-band-text': t.bandText,
    '--t-stamp': t.stamp,
    '--t-accent': t.accent,
    '--t-on-accent': t.onAccent,
    '--ion-background-color': t.bg,
    '--ion-background-color-rgb': rgb(t.bg),
    '--ion-toolbar-background': t.bg,
    '--ion-color-primary': t.accent,
    '--ion-color-primary-rgb': rgb(t.accent),
    '--ion-color-primary-contrast': t.onAccent,
    '--ion-color-primary-shade': t.accent,
    '--ion-color-primary-tint': t.accent,
  }
}
