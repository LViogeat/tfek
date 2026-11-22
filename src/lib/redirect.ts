/**
 * Chemin de retour après connexion, limité aux pages de l'app.
 * Refuse tout ce qui pourrait sortir de l'origine : `//hôte`, `/\hôte`, `http:…`, etc.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('\\')) return '/'
  try {
    const base = 'https://tfek.invalid'
    const url = new URL(value, base)
    if (url.origin !== base) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
