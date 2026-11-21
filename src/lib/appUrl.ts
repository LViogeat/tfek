import { Capacitor } from '@capacitor/core'

/**
 * Origine publique de l'app (liens partagés, redirections d'auth).
 * Sur le web : VITE_PUBLIC_URL ou l'origine courante.
 * En natif (Capacitor), l'origine de la WebView (capacitor://localhost, https://localhost)
 * n'est pas joignable de l'extérieur : VITE_PUBLIC_URL est obligatoire.
 */
export function publicOrigin(): string {
  const configured = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '')
  if (configured) return configured
  if (Capacitor.isNativePlatform()) {
    throw new Error('VITE_PUBLIC_URL doit être défini pour les builds natifs (liens partagés et connexion)')
  }
  return window.location.origin
}

export function publicUrl(path: string): string {
  return new URL(path, publicOrigin() + '/').toString()
}
